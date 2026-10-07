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
const heroEl = document.querySelector('#hero')
const greetingEl = document.querySelector('#greeting')
const homeBtn = document.querySelector('#home-btn')
const detailsEl = document.querySelector('#details')
const tipEl = document.querySelector('#tip')
const suggestListEl = document.querySelector('#suggest-list')
const locateBtn = document.querySelector('#locate-btn')
const shareBtn = document.querySelector('#share-btn')
const hourlyEl = document.querySelector('#hourly')

// ===== 2. Data tetap =====
const WEATHER_TEXT = {
  0: 'Cerah', 1: 'Cerah berawan', 2: 'Berawan sebagian', 3: 'Berawan',
  45: 'Berkabut', 48: 'Berkabut',
  51: 'Gerimis ringan', 53: 'Gerimis', 55: 'Gerimis lebat',
  61: 'Hujan ringan', 63: 'Hujan', 65: 'Hujan lebat',
  80: 'Hujan lokal', 81: 'Hujan lokal', 82: 'Hujan deras lokal',
  95: 'Badai petir', 96: 'Badai petir', 99: 'Badai petir',
}
const WEATHER_ICON = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌦️', 63: '🌧️', 65: '🌧️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}
const SUGGESTIONS = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Medan']
const HISTORY_KEY = 'weather-history'
const UNIT_KEY = 'weather-unit'
const CHIP_CLASS =
  'rounded-full border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-sky-100 focus:outline-2 focus:outline-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'

// ===== 3. State =====
// Data asli selalu dalam °C. Satuan hanya memengaruhi tampilan.
let unit = readStorage(UNIT_KEY) === 'F' ? 'F' : 'C'
let current = null // { place, weather, daily }
let searchId = 0

// ===== 4. localStorage =====
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
    const list = JSON.parse(readStorage(HISTORY_KEY)) ?? []
    return list.filter((p) => p && typeof p === 'object' && 'latitude' in p) // abaikan format lama
  } catch {
    return []
  }
}

function saveHistory(place) {
  const { name, admin1, country, latitude, longitude } = place
  const list = loadHistory().filter((p) => !(p.latitude === latitude && p.longitude === longitude))
  list.unshift({ name, admin1, country, latitude, longitude })
  writeStorage(HISTORY_KEY, JSON.stringify(list.slice(0, 5)))
}

// ===== 5. Pengambil data =====
async function fetchPlaces(name, count = 5) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=id&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mencari kota. Coba lagi nanti.')
  const data = await res.json()
  return data.results ?? []
}

const placeLabel = (p) => [p.admin1, p.country].filter(Boolean).join(', ')

async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max,sunrise,sunset` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,is_day` +
    `&timezone=auto&forecast_days=5`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mengambil data cuaca. Coba lagi nanti.')
  const data = await res.json()
  return { current: data.current, daily: data.daily, hourly: data.hourly }
}

// ===== 6. Fungsi bantu tampilan =====
const toDisplay = (celsius) => Math.round(unit === 'F' ? (celsius * 9) / 5 + 32 : celsius)

// Kode cuaca -> nama tema latar (gaya ada di style.css)
function themeOf(code) {
  if (code <= 1) return 'clear'
  if (code <= 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 95) return 'storm'
  return 'rain'
}

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

function makeChip(label, onClick, title = '') {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = label
  btn.title = title
  btn.className = CHIP_CLASS
  btn.addEventListener('click', onClick)
  return btn
}

function renderHistory() {
  historyEl.innerHTML = ''
  const items = loadHistory()

  if (items.length === 0) {
    // Belum ada riwayat: tawarkan kota populer
    const label = document.createElement('span')
    label.className = 'text-sm text-slate-600 dark:text-slate-300'
    label.textContent = 'Coba kota ini:'
    const chips = SUGGESTIONS.map((city) =>
      makeChip(city, () => {
        input.value = city
        search(city)
      }),
    )
    historyEl.append(label, ...chips)
    return
  }

  // Riwayat menyimpan lokasi lengkap, jadi langsung menampilkan cuacanya
  const chips = items.map((p) =>
    makeChip(
      p.name,
      () => {
        input.value = p.name
        searchPlace(p)
      },
      placeLabel(p),
    ),
  )
  historyEl.append(...chips)

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

const COMPASS = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut']
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8]

function uvLabel(uv) {
  if (uv < 3) return 'Rendah'
  if (uv < 6) return 'Sedang'
  if (uv < 8) return 'Tinggi'
  if (uv < 11) return 'Sangat tinggi'
  return 'Ekstrem'
}

function weatherTip(rain, uv, temp) {
  if (rain >= 60) return 'Peluang hujan tinggi hari ini, bawa payung.'
  if (rain >= 30) return 'Ada kemungkinan hujan, siapkan payung lipat.'
  if (uv >= 8) return 'Sinar UV sangat tinggi, pakai tabir surya dan hindari matahari siang.'
  if (temp >= 33) return 'Cuaca panas, jangan lupa minum air putih.'
  return 'Cuaca cukup nyaman untuk beraktivitas.'
}

function renderDetails(weather, daily) {
  const windMs = (weather.wind_speed_10m / 3.6).toFixed(1)
  const dir = weather.wind_direction_10m ?? 0
  const rain = daily.precipitation_probability_max?.[0]
  const uv = daily.uv_index_max?.[0]
  const items = [
    ['Terasa seperti', `${toDisplay(weather.apparent_temperature)}°${unit}`],
    ['Kelembapan', `${weather.relative_humidity_2m}%`],
    [
      'Angin',
      `${windMs} m/s<span class="block text-sm font-normal text-slate-600 dark:text-slate-300"><span class="inline-block" style="transform:rotate(${dir + 180}deg)" aria-hidden="true">↑</span> dari ${compass(dir)}</span>`,
    ],
    ['Peluang hujan', rain != null ? `${rain}%` : '-'],
    ['Indeks UV', uv != null ? `${Math.round(uv)}<span class="block text-sm font-normal text-slate-600 dark:text-slate-300">${uvLabel(uv)}</span>` : '-'],
    ['Matahari', `${daily.sunrise[0].slice(11, 16)} / ${daily.sunset[0].slice(11, 16)}`],
  ]
  detailsEl.innerHTML = items
    .map(
      ([label, value]) =>
        `<div class="rounded-lg bg-slate-100 p-3 dark:bg-slate-700/50"><dt class="text-sm text-slate-600 dark:text-slate-300">${label}</dt><dd class="text-lg font-medium">${value}</dd></div>`,
    )
    .join('')
  tipEl.textContent = weatherTip(rain ?? 0, uv ?? 0, weather.temperature_2m)
}

function iconFor(code, isDay = 1) {
  if (!isDay) {
    if (code <= 1) return '🌙'
    if (code === 2) return '☁️'
  }
  return WEATHER_ICON[code] ?? ''
}

function renderHourly(weather, hourly) {
  // Mulai dari jam sekarang di kota tersebut (format teks ISO bisa dibandingkan langsung)
  const nowHour = weather.time.slice(0, 13) + ':00'
  const start = Math.max(hourly.time.findIndex((t) => t >= nowHour), 0)
  hourlyEl.innerHTML = hourly.time
    .slice(start, start + 24)
    .map((t, k) => {
      const i = start + k
      const code = hourly.weather_code[i]
      const rain = hourly.precipitation_probability?.[i]
      return `
      <li class="min-w-16 shrink-0 rounded-lg bg-slate-100 p-2 text-center dark:bg-slate-700/50">
        <div class="text-xs text-slate-600 dark:text-slate-300">${k === 0 ? 'Sekarang' : t.slice(11, 16)}</div>
        <div class="my-1 text-2xl" aria-hidden="true">${iconFor(code, hourly.is_day[i])}</div>
        <span class="sr-only">${WEATHER_TEXT[code] ?? ''}</span>
        <div class="font-medium tabular-nums">${toDisplay(hourly.temperature_2m[i])}°</div>
        <div class="text-xs text-sky-700 dark:text-sky-300">${rain != null ? `${rain}%` : ''}</div>
      </li>`
    })
    .join('')
}

function render() {
  if (!current) return
  const { place, weather, daily, hourly } = current

  document.body.dataset.theme = themeOf(weather.weather_code)
  setNight(weather.is_day === 0)
  setRain(['rain', 'storm'].includes(document.body.dataset.theme) ? document.body.dataset.theme : 'off')
  document.querySelector('#place').textContent = [place.name, place.admin1, place.country].filter(Boolean).join(', ')
  document.querySelector('#temp').textContent = `${toDisplay(weather.temperature_2m)}°${unit}`
  document.querySelector('#icon').textContent = iconFor(weather.weather_code, weather.is_day)
  document.querySelector('#desc').textContent = WEATHER_TEXT[weather.weather_code] ?? 'Tidak diketahui'
  renderDetails(weather, daily)
  renderHourly(weather, hourly)

  // Bar rentang suhu: posisi dihitung terhadap suhu terendah dan tertinggi minggu ini
  const weekMin = Math.min(...daily.temperature_2m_min)
  const weekMax = Math.max(...daily.temperature_2m_max)
  const span = weekMax - weekMin || 1

  forecastEl.innerHTML = daily.time
    .map((date, i) => {
      const lo = daily.temperature_2m_min[i]
      const hi = daily.temperature_2m_max[i]
      const code = daily.weather_code[i]
      const rain = daily.precipitation_probability_max?.[i]
      const width = Math.max(((hi - lo) / span) * 100, 6)
      const left = Math.min(((lo - weekMin) / span) * 100, 100 - width)
      return `
      <li class="py-2 ${i === 0 ? 'text-sky-700 dark:text-sky-300' : ''}">
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium">${dayName(date, i)}</span>
          <span class="tabular-nums">${toDisplay(hi)}° / ${toDisplay(lo)}°</span>
        </div>
        <div class="mt-0.5 flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span><span aria-hidden="true">${WEATHER_ICON[code] ?? ''}</span> ${WEATHER_TEXT[code] ?? '-'}</span>
          <span>${rain != null ? `<span class="sr-only">Peluang hujan </span><span aria-hidden="true">💧</span> ${rain}%` : ''}</span>
        </div>
        <div class="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
          <div class="h-full rounded-full bg-sky-500" style="margin-left:${left}%;width:${width}%"></div>
        </div>
      </li>`
    })
    .join('')
}

// ===== 7. Alur pencarian =====
function showError(error) {
  const offline = error instanceof TypeError
  showStatus(offline ? 'Tidak bisa terhubung ke internet.' : error.message, true)
}

function startLoading() {
  const id = ++searchId
  button.disabled = true
  resultEl.classList.add('hidden')
  statusEl.classList.add('hidden')
  skeletonEl.classList.remove('hidden')
  return id
}

function stopLoading(id) {
  if (id !== searchId) return
  skeletonEl.classList.add('hidden')
  button.disabled = false
}

// Menampilkan cuaca untuk satu lokasi yang sudah pasti
async function searchPlace(place, { remember = true } = {}) {
  const id = startLoading()
  heroEl.classList.add('hidden')
  try {
    const { current: weather, daily, hourly } = await getWeather(place.latitude, place.longitude)
    if (id !== searchId) return
    current = { place, weather, daily, hourly }
    render()
    if (remember) {
      saveHistory(place)
      renderHistory()
      updateUrl(place)
    } else {
      history.replaceState(null, '', location.pathname) // lokasi GPS tidak masuk URL maupun riwayat
    }
    shareBtn.classList.toggle('hidden', !remember)
    resultEl.classList.remove('hidden')
  } catch (error) {
    if (id !== searchId) return
    showError(error)
  } finally {
    stopLoading(id)
  }
}

// Pencarian dari teks: kalau hasilnya ambigu, pengguna yang memilih
async function search(city) {
  const id = startLoading()
  try {
    const places = await fetchPlaces(city)
    if (id !== searchId) return
    if (places.length === 0) throw new Error(`Kota "${city}" tidak ditemukan. Periksa ejaannya.`)
    // Langsung tampilkan hanya jika jelas: satu-satunya hasil, atau namanya persis
    // dan jumlah penduduknya jauh di atas hasil lain. Selain itu, pengguna yang memilih.
    const [top, second] = [...places].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    const clear =
      places.length === 1 ||
      (top.name.toLowerCase() === city.toLowerCase() && top.population > (second.population ?? 0) * 5)
    if (clear) return searchPlace(top)
    showSuggestions(places)
    showStatus(`Ada beberapa lokasi bernama "${city}". Pilih salah satu dari daftar.`)
    input.focus()
  } catch (error) {
    if (id !== searchId) return
    showError(error)
  } finally {
    stopLoading(id)
  }
}

// ===== URL yang bisa dibagikan =====
function updateUrl(place) {
  const params = new URLSearchParams({ kota: place.name, lat: place.latitude, lon: place.longitude })
  if (place.admin1) params.set('provinsi', place.admin1)
  if (place.country) params.set('negara', place.country)
  history.replaceState(null, '', `?${params}`)
}

// Isi URL berasal dari luar, jadi koordinatnya divalidasi dulu
function loadFromUrl() {
  const params = new URLSearchParams(location.search)
  const name = params.get('kota')?.trim()
  if (!name) return
  input.value = name
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  const valid = params.has('lat') && params.has('lon') && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  if (valid) {
    searchPlace({
      name,
      admin1: params.get('provinsi') ?? undefined,
      country: params.get('negara') ?? undefined,
      latitude: lat,
      longitude: lon,
    })
  } else {
    search(name) // tautan buatan sendiri, misalnya ?kota=Bandung
  }
}

shareBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href)
    shareBtn.textContent = 'Tautan disalin ✓'
  } catch {
    shareBtn.textContent = 'Gagal menyalin'
  }
  setTimeout(() => {
    shareBtn.textContent = 'Bagikan'
  }, 2000)
})

// ===== Lokasi saya (Geolocation API) =====
function locate() {
  if (!('geolocation' in navigator)) {
    showStatus('Browser Anda tidak mendukung fitur lokasi.', true)
    return
  }
  locateBtn.disabled = true
  showStatus('Mencari lokasi Anda...')
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      locateBtn.disabled = false
      // Dibulatkan 2 desimal (sekitar 1 km), cukup untuk cuaca dan lebih privat
      const place = {
        name: 'Lokasi Anda',
        latitude: Number(coords.latitude.toFixed(2)),
        longitude: Number(coords.longitude.toFixed(2)),
      }
      searchPlace(place, { remember: false })
    },
    (error) => {
      locateBtn.disabled = false
      showStatus(
        error.code === error.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Aktifkan di pengaturan browser, atau cari kota secara manual.'
          : 'Lokasi tidak dapat ditentukan. Coba lagi atau cari kota secara manual.',
        true,
      )
    },
    { timeout: 10000 },
  )
}

locateBtn.addEventListener('click', locate)

// ===== Autocomplete =====
let suggestions = []
let activeIndex = -1
let suggestSeq = 0
let suggestTimer

function hideSuggestions() {
  suggestListEl.classList.add('hidden')
  input.setAttribute('aria-expanded', 'false')
  input.removeAttribute('aria-activedescendant')
  activeIndex = -1
}

function choose(place) {
  input.value = place.name
  hideSuggestions()
  searchPlace(place)
}

function setActive(index) {
  activeIndex = index
  Array.from(suggestListEl.children).forEach((li, i) => li.setAttribute('aria-selected', String(i === index)))
  input.setAttribute('aria-activedescendant', `opt-${index}`)
  suggestListEl.children[index]?.scrollIntoView({ block: 'nearest' })
}

function showSuggestions(places) {
  suggestions = places
  activeIndex = -1
  suggestListEl.innerHTML = ''
  places.forEach((place, i) => {
    const li = document.createElement('li')
    li.id = `opt-${i}`
    li.setAttribute('role', 'option')
    li.className =
      'cursor-pointer px-4 py-2 hover:bg-sky-100 aria-selected:bg-sky-100 dark:hover:bg-slate-700 dark:aria-selected:bg-slate-700'
    const name = document.createElement('span')
    name.className = 'font-medium'
    name.textContent = place.name
    const sub = document.createElement('span')
    sub.className = 'block text-sm text-slate-600 dark:text-slate-300'
    sub.textContent = placeLabel(place)
    li.append(name, sub)
    // mousedown (bukan click) agar terpicu sebelum input kehilangan fokus
    li.addEventListener('mousedown', (event) => {
      event.preventDefault()
      choose(place)
    })
    suggestListEl.append(li)
  })
  suggestListEl.classList.toggle('hidden', places.length === 0)
  input.setAttribute('aria-expanded', String(places.length > 0))
}

input.addEventListener('input', () => {
  clearTimeout(suggestTimer)
  const q = input.value.trim()
  if (q.length < 2) {
    suggestSeq++
    hideSuggestions()
    return
  }
  // Debounce: tunggu 300 ms setelah berhenti mengetik
  suggestTimer = setTimeout(async () => {
    const seq = ++suggestSeq
    try {
      const places = await fetchPlaces(q)
      if (seq === suggestSeq) showSuggestions(places)
    } catch {
      // saran gagal dimuat: abaikan, pencarian manual tetap bisa dipakai
    }
  }, 300)
})

input.addEventListener('keydown', (event) => {
  const open = !suggestListEl.classList.contains('hidden')
  if (event.key === 'ArrowDown' && open) {
    event.preventDefault()
    setActive((activeIndex + 1) % suggestions.length)
  } else if (event.key === 'ArrowUp' && open) {
    event.preventDefault()
    setActive((activeIndex - 1 + suggestions.length) % suggestions.length)
  } else if (event.key === 'Enter' && open && activeIndex >= 0) {
    event.preventDefault()
    choose(suggestions[activeIndex])
  } else if (event.key === 'Escape') {
    hideSuggestions()
  }
})

input.addEventListener('blur', hideSuggestions)

// ===== Animasi hujan (canvas) =====
const rainCanvas = document.querySelector('#rain')
const rainCtx = rainCanvas.getContext('2d')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let rainMode = 'off' // 'off' | 'rain' | 'storm'
let rainFrame = null
let drops = []

function resizeRain() {
  const dpr = window.devicePixelRatio || 1
  rainCanvas.width = window.innerWidth * dpr
  rainCanvas.height = window.innerHeight * dpr
  rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// depth: 0 = jauh (pendek, tipis, pelan), 1 = dekat (panjang, tebal, cepat)
function makeDrop(initial) {
  const depth = Math.random()
  return {
    x: Math.random() * (window.innerWidth + 200) - 50,
    y: initial ? Math.random() * window.innerHeight : -30,
    len: 8 + depth * 16,
    speed: 7 + depth * 11,
    alpha: 0.1 + depth * 0.3,
    width: 0.6 + depth * 0.9,
  }
}

function drawRain() {
  const w = window.innerWidth
  const h = window.innerHeight
  rainCtx.clearRect(0, 0, w, h)
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const rgb = dark ? '186, 213, 255' : '37, 80, 150'
  const storm = rainMode === 'storm'
  const slant = storm ? 0.35 : 0.15 // kemiringan akibat angin
  const boost = storm ? 1.3 : 1
  rainCtx.lineCap = 'round'
  for (const d of drops) {
    rainCtx.strokeStyle = `rgba(${rgb}, ${d.alpha})`
    rainCtx.lineWidth = d.width
    rainCtx.beginPath()
    rainCtx.moveTo(d.x, d.y)
    rainCtx.lineTo(d.x + d.len * slant, d.y - d.len) // ekor tetesan di belakang arah jatuh
    rainCtx.stroke()
    d.y += d.speed * boost
    d.x -= d.speed * boost * slant
    if (d.y - d.len > h || d.x < -60) Object.assign(d, makeDrop(false))
  }
  rainFrame = requestAnimationFrame(drawRain)
}

function setRain(mode) {
  if (reduceMotion.matches) mode = 'off'
  if (mode === rainMode) return
  rainMode = mode
  cancelAnimationFrame(rainFrame)
  rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height)
  if (mode === 'off') return
  resizeRain()
  const count = Math.max(40, Math.min(200, Math.round(window.innerWidth / (mode === 'storm' ? 7 : 12))))
  drops = Array.from({ length: count }, () => makeDrop(true))
  rainFrame = requestAnimationFrame(drawRain)
}

window.addEventListener('resize', () => {
  if (rainMode !== 'off') resizeRain()
})

// ===== Bintang (canvas, hanya saat malam dan mode gelap) =====
const starCanvas = document.querySelector('#stars')
const starCtx = starCanvas.getContext('2d')
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
let stars = []
let starFrame = null
let starResizeTimer

function resizeStars() {
  const dpr = window.devicePixelRatio || 1
  starCanvas.width = window.innerWidth * dpr
  starCanvas.height = window.innerHeight * dpr
  starCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function drawStars(time) {
  starCtx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  for (const star of stars) {
    const twinkle = reduceMotion.matches ? 1 : 0.65 + 0.35 * Math.sin((time / 1000) * star.speed + star.phase)
    starCtx.globalAlpha = star.alpha * twinkle
    starCtx.fillStyle = '#ffffff'
    starCtx.shadowBlur = star.r > 1.2 ? 6 : 0 // cahaya lembut hanya untuk bintang besar
    starCtx.shadowColor = 'rgba(190, 215, 255, 0.9)'
    starCtx.beginPath()
    starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
    starCtx.fill()
  }
  starCtx.globalAlpha = 1
  starCtx.shadowBlur = 0
  if (!reduceMotion.matches) starFrame = requestAnimationFrame(drawStars)
}

function setStars(on) {
  cancelAnimationFrame(starFrame)
  starFrame = null
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height)
  if (!on || !darkQuery.matches) return
  resizeStars()
  const count = Math.max(60, Math.min(220, Math.round((window.innerWidth * window.innerHeight) / 7000)))
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 0.5 + Math.random() ** 3 * 1.5, // kebanyakan kecil, sedikit yang besar
    alpha: 0.45 + Math.random() * 0.5,
    speed: 0.6 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
  }))
  if (reduceMotion.matches) drawStars(0)
  else starFrame = requestAnimationFrame(drawStars)
}

function setNight(isNight) {
  document.body.dataset.night = String(isNight)
  setStars(isNight)
}

const refreshStars = () => setStars(document.body.dataset.night === 'true')
window.addEventListener('resize', () => {
  clearTimeout(starResizeTimer)
  starResizeTimer = setTimeout(refreshStars, 200)
})
darkQuery.addEventListener('change', refreshStars)

// ===== 8. Event =====
form.addEventListener('submit', (event) => {
  event.preventDefault()
  clearTimeout(suggestTimer)
  suggestSeq++
  hideSuggestions()
  const city = input.value.trim()
  if (city) search(city)
})

unitBtn.addEventListener('click', () => {
  unit = unit === 'C' ? 'F' : 'C'
  writeStorage(UNIT_KEY, unit)
  unitBtn.textContent = `°${unit}`
  render() // tanpa fetch ulang: data °C yang sama, hanya dikonversi
})

homeBtn.addEventListener('click', () => {
  searchId++ // batalkan pencarian yang masih berjalan
  hideSuggestions()
  history.replaceState(null, '', location.pathname)
  setRain('off')
  current = null
  resultEl.classList.add('hidden')
  statusEl.classList.add('hidden')
  skeletonEl.classList.add('hidden')
  heroEl.classList.remove('hidden')
  button.disabled = false
  input.value = ''
  document.body.dataset.theme = 'clear'
  setNight(isNightLocal)
  window.scrollTo({ top: 0 })
})

// ===== 9. Awal halaman =====
unitBtn.textContent = `°${unit}`
renderHistory()

// ===== 10. Sapaan awal =====
const hour = new Date().getHours()
const greeting =
  hour < 4 ? 'Selamat malam' : hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
greetingEl.textContent = `${greeting}!`
const isNightLocal = hour >= 18 || hour < 5
heroEl.dataset.time = isNightLocal ? 'night' : 'day'
document.body.dataset.theme = 'clear'
setNight(isNightLocal)

// ===== 11. Buka dari tautan =====
loadFromUrl()