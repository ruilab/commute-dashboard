/**
 * Weather service using Open-Meteo (free, no API key needed).
 * Focused on commute-relevant factors only.
 *
 * Location: Jersey City / Lower Manhattan area
 * Lat: 40.7178, Lon: -74.0431 (JSQ area)
 */

export interface WeatherInfo {
  temperature: number; // Fahrenheit
  feelsLike: number;
  precipProbability: number; // 0-100
  precipType: string | null;
  windSpeed: number; // mph
  condition: string;
  isSevere: boolean;
  forecastHours: HourForecast[];
  lastUpdated: Date;
  source: string;
}

export interface HourForecast {
  hour: number;
  temperature: number;
  precipProbability: number;
  condition: string;
}

const LAT = 40.7178;
const LON = -74.0431;

function weatherCodeToCondition(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 49) return "fog";
  if (code <= 59) return "drizzle";
  if (code <= 69) return "rain";
  if (code <= 79) return "snow";
  if (code <= 82) return "rain";
  if (code <= 86) return "snow";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
}

function isSevereWeather(code: number): boolean {
  return code >= 95; // Thunderstorm codes
}

function getPrecipType(code: number): string | null {
  if (code >= 71 && code <= 79) return "snow";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 51 && code <= 69) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 95) return "thunderstorm";
  return null;
}

export async function getWeather(): Promise<WeatherInfo> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(LAT));
    url.searchParams.set("longitude", String(LON));
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m"
    );
    url.searchParams.set(
      "hourly",
      "temperature_2m,precipitation_probability,weather_code"
    );
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "America/New_York");

    const res = await fetch(url.toString(), {
      next: { revalidate: 600 }, // Cache 10 min
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

    const data = await res.json();
    const current = data.current;
    const hourly = data.hourly;

    // Build next few hours forecast
    const now = new Date();
    const currentHour = now.getHours();
    const forecastHours: HourForecast[] = [];

    if (hourly?.time) {
      for (let i = 0; i < hourly.time.length; i++) {
        const hourDate = new Date(hourly.time[i]);
        const hour = hourDate.getHours();
        if (hour >= currentHour && hour <= currentHour + 6) {
          forecastHours.push({
            hour,
            temperature: hourly.temperature_2m[i],
            precipProbability: hourly.precipitation_probability[i] || 0,
            condition: weatherCodeToCondition(hourly.weather_code[i]),
          });
        }
      }
    }

    const weatherCode = current.weather_code;

    return {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      precipProbability: current.precipitation_probability || 0,
      precipType: getPrecipType(weatherCode),
      windSpeed: current.wind_speed_10m,
      condition: weatherCodeToCondition(weatherCode),
      isSevere: isSevereWeather(weatherCode),
      forecastHours,
      lastUpdated: new Date(),
      source: "open-meteo",
    };
  } catch {
    // Graceful degradation
    return {
      temperature: 0,
      feelsLike: 0,
      precipProbability: 0,
      precipType: null,
      windSpeed: 0,
      condition: "unknown",
      isSevere: false,
      forecastHours: [],
      lastUpdated: new Date(),
      source: "unavailable",
    };
  }
}

/**
 * Get weather penalty score (0-1, higher = worse commute impact)
 */
export function getWeatherPenalty(info: WeatherInfo): number {
  if (info.source === "unavailable") return 0.1; // Small uncertainty penalty
  let penalty = 0;

  // Precipitation
  if (info.precipProbability > 70) penalty += 0.3;
  else if (info.precipProbability > 40) penalty += 0.15;

  // Severe weather
  if (info.isSevere) penalty += 0.5;

  // Extreme cold/heat
  if (info.feelsLike < 20 || info.feelsLike > 95) penalty += 0.15;

  // High wind
  if (info.windSpeed > 25) penalty += 0.15;
  else if (info.windSpeed > 15) penalty += 0.05;

  return Math.min(penalty, 1.0);
}
