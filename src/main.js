import './style.css'

// 1. Ambil elemen yang akan dimanipulasi
const form = document.querySelector('#search-form')
const input = document.querySelector('#city-input')
const button = document.querySelector('#search-btn')
const statusEl = document.querySelector('#status')
const resultEl = document.querySelector('#result')

// 2. Kode cuaca Open-Meteo (WMO) -> teks bahasa Indonesia
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

// 3. Fungsi pengambil data (async/await + fetch)
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
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mengambil data cuaca. Coba lagi nanti.')
  const data = await res.json()
  return data.current
}

// 4. Fungsi tampilan
function showStatus(message) {
  statusEl.textContent = message
  statusEl.classList.remove('hidden')
}

function showResult(place, weather) {
  document.querySelector('#place').textContent = `${place.name}, ${place.country ?? ''}`
  document.querySelector('#temp').textContent = `${Math.round(weather.temperature_2m)}°C`
  document.querySelector('#desc').textContent = WEATHER_TEXT[weather.weather_code] ?? 'Tidak diketahui'
  document.querySelector('#humidity').textContent = `${weather.relative_humidity_2m}%`
  document.querySelector('#wind').textContent = `${weather.wind_speed_10m} km/jam`
  statusEl.classList.add('hidden')
  resultEl.classList.remove('hidden')
}

// 5. Event handler form
form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const city = input.value.trim()
  if (!city) return

  button.disabled = true
  resultEl.classList.add('hidden')
  showStatus('Memuat data cuaca...')

  try {
    const place = await getCoordinates(city)
    const weather = await getWeather(place.latitude, place.longitude)
    showResult(place, weather)
  } catch (error) {
    // Error jaringan juga masuk ke sini (misalnya saat offline)
    const offline = error instanceof TypeError
    showStatus(offline ? 'Tidak bisa terhubung ke internet.' : error.message)
  } finally {
    button.disabled = false
  }
})