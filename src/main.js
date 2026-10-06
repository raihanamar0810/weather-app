import './style.css'

// ===== 1. Elemen =====
const form = document.querySelector('#search-form')
const input = document.querySelector('#city-input')
const button = document.querySelector('#search-btn')
const statusEl = document.querySelector('#status')
const resultEl = document.querySelector('#result')
const skeletonEl = document.querySelector('#skeleton')
const historyEl = document.querySelector('#history')
const unitBtn = document.querySelector('#unit-btn')
const forecastEl = document.querySelector('#forecast')

// ===== 2. Data tetap =====
const WEATHER_TEXT = {
  0: 'Cerah',
  1: 'Cerah berawan',
  2: 'Berawan sebagian',
  3: 'Berawan',
  45: 'Berkabut',
  48: 'Berkabut',
  51: 'Gerimis ringan',
  53: 'Gerimis',
  55: 'Gerimis lebat',
  61: 'Hujan ringan',
  63: 'Hujan',
  65: 'Hujan lebat',
  80: 'Hujan lokal',
  81: 'Hujan lokal',
  82: 'Hujan deras lokal',
  95: 'Badai petir',
  96: 'Badai petir',
  99: 'Badai petir',
}

const WEATHER_ICON = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌦️', 63: '🌧️', 65: '🌧️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}
const HISTORY_KEY = 'weather-history'
const UNIT_KEY = 'weather-unit'

// ===== 3. State =====
// Data asli selalu disimpan dalam °C. Satuan hanya memengaruhi tampilan.
let unit = readStorage(UNIT_KEY) === 'F' ? 'F' : 'C'
let current = null // { place, weather, daily }

// ===== 4. localStorage (dibungkus try/catch karena bisa gagal) =====
function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // abaikan: fitur utama tetap jalan tanpa penyimpanan
  }
}

function loadHistory() {
  try {
    return JSON.parse(readStorage(HISTORY_KEY)) ?? []
  } catch {
    return []
  }
}

function saveHistory(city) {
  const list = loadHistory().filter((c) => c.toLowerCase() !== city.toLowerCase())
  list.unshift(city) // kota terbaru di paling depan
  writeStorage(HISTORY_KEY, JSON.stringify(list.slice(0, 5)))
}

// ===== 5. Pengambil data =====
async function getCoordinates(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=id&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mencari kota. Coba lagi nanti.')
  const data = await res.json()
  if (!data.results || data.results.length === 0) {
    throw new Error(`Kota "${city}" tidak ditemukan. Periksa ejaannya.`)
  }
  return data.results[0]
}

async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto&forecast_days=5`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mengambil data cuaca. Coba lagi nanti.')
  const data = await res.json()
  return { current: data.current, daily: data.daily }
}

// ===== 6. Fungsi bantu tampilan =====
const toDisplay = (celsius) => Math.round(unit === 'F' ? (celsius * 9) / 5 + 32 : celsius)

function dayName(dateStr, index) {
  if (index === 0) return 'Hari ini'
  // Dipecah manual agar tidak bergeser sehari karena zona waktu
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long' })
}

function showStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.setAttribute('role', isError ? 'alert' : 'status')
  statusEl.classList.toggle('text-red-700', isError)
  statusEl.classList.toggle('dark:text-red-300', isError)
  statusEl.classList.toggle('text-slate-600', !isError)
  statusEl.classList.toggle('dark:text-slate-300', !isError)
  statusEl.classList.remove('hidden')
}

function renderHistory() {
  historyEl.innerHTML = ''
  const items = loadHistory()

  items.forEach((city) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = city
    btn.className =
      'rounded-full border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-sky-100 focus:outline-2 focus:outline-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'
    btn.addEventListener('click', () => {
      input.value = city
      search(city)
    })
    historyEl.append(btn)
  })

  if (items.length > 0) {
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.textContent = 'Hapus riwayat'
    clear.className =
      'px-2 py-1 text-sm text-slate-600 underline hover:text-red-700 dark:text-slate-300 dark:hover:text-red-300'
    clear.addEventListener('click', () => {
      writeStorage(HISTORY_KEY, '[]')
      renderHistory()
    })
    historyEl.append(clear)
  }
}

function render() {
  if (!current) return
  const { place, weather, daily } = current

  document.querySelector('#place').textContent = [place.name, place.admin1, place.country].filter(Boolean).join(', ')
  document.querySelector('#temp').textContent = `${toDisplay(weather.temperature_2m)}°${unit}`
  document.querySelector('#icon').textContent = WEATHER_ICON[weather.weather_code] ?? ''
  document.querySelector('#desc').textContent = WEATHER_TEXT[weather.weather_code] ?? 'Tidak diketahui'
  document.querySelector('#humidity').textContent = `${weather.relative_humidity_2m}%`
  const windMs = (weather.wind_speed_10m / 3.6).toFixed(1)
  document.querySelector('#wind').textContent = `${windMs} m/s`

  // Tiga array sejajar: indeks yang sama = hari yang sama
  forecastEl.innerHTML = daily.time
    .map(
      (date, i) => `
      <li class="flex items-center justify-between gap-3 py-2 ${i === 0 ? 'text-sky-700 dark:text-sky-300' : ''}">
        <span class="w-24 font-medium">${dayName(date, i)}</span>
        <span class="flex-1 text-sm text-slate-600 dark:text-slate-300"><span aria-hidden="true">${WEATHER_ICON[daily.weather_code[i]] ?? ''}</span> ${WEATHER_TEXT[daily.weather_code[i]] ?? '-'}</span>
        <span class="tabular-nums">${toDisplay(daily.temperature_2m_max[i])}° / ${toDisplay(daily.temperature_2m_min[i])}°</span>
      </li>`,
    )
    .join('')
}

// ===== 7. Alur pencarian =====
let searchId = 0

async function search(city) {
  const id = ++searchId
  button.disabled = true
  resultEl.classList.add('hidden')
  statusEl.classList.add('hidden')
  skeletonEl.classList.remove('hidden')

  try {
    const place = await getCoordinates(city)
    const { current: weather, daily } = await getWeather(place.latitude, place.longitude)
    if (id !== searchId) return
    current = { place, weather, daily }
    render()
    saveHistory(place.name)
    renderHistory()
    resultEl.classList.remove('hidden')
  } catch (error) {
    if (id !== searchId) return
    const offline = error instanceof TypeError
    showStatus(offline ? 'Tidak bisa terhubung ke internet.' : error.message, true)
  } finally {
    if (id === searchId) {
      skeletonEl.classList.add('hidden')
      button.disabled = false
    }
  }
}

// ===== 8. Event =====
form.addEventListener('submit', (event) => {
  event.preventDefault()
  const city = input.value.trim()
  if (city) search(city)
})

unitBtn.addEventListener('click', () => {
  unit = unit === 'C' ? 'F' : 'C'
  writeStorage(UNIT_KEY, unit)
  unitBtn.textContent = `°${unit}`
  render() // tanpa fetch ulang: data °C yang sama, hanya dikonversi
})

// ===== 9. Awal halaman =====
unitBtn.textContent = `°${unit}`
renderHistory()