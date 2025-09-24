class WeatherApp {
  constructor() {
    this.uiController = new UIController(this);
    this.locationService = new LocationService();
    this.weatherApi = new WeatherAPI();
    this.weatherData = null;
    this.selectedDay = 0;
    this.lastLocation = null;

    this.units = {
      temperature: "celsius",
      windSpeed: "kmh",
      precipitation: "mm",
      system: "metric",
    };

    this.imperialUnits = new Set(["fahrenheit", "mph", "inches"]);
  }

  init() {
    this.uiController.bindEvents();
    this.uiController.showInitialState();
  }

  async handleSearch(location) {
    try {
      this.uiController.showSearchLoader();

      const foundCity = await this.locationService.getLocation(location);

      if (!foundCity) {
        this.uiController.hideSearchLoader();
        this.uiController.showNoResult();
        return;
      }

      this.uiController.showAllLoading();
      this.lastLocation = foundCity;

      const weatherData = await this.weatherApi.getWeather(
        foundCity.latitude,
        foundCity.longitude
      );

      this.weatherData = weatherData;
      this.uiController.updateWeatherDisplay(foundCity, weatherData);
      this.uiController.hideSearchLoader();
      this.uiController.hideAllLoading();
    } catch (error) {
      console.error("Erro na API:", error);
      this.uiController.hideSearchLoader();
      this.uiController.hideAllLoading();
      this.uiController.showError();
    }
  }

  handleDaySelect(dayIndex) {
    this.selectedDay = dayIndex;

    if (this.weatherData) {
      this.uiController.updateHourlyForecast(this.weatherData.hourly, dayIndex);
    }
  }

  // Decide se o sistema é metric ou imperial
  determineSystem() {
    const hasImperialUnit =
      this.imperialUnits.has(this.units.temperature) ||
      this.imperialUnits.has(this.units.windSpeed) ||
      this.imperialUnits.has(this.units.precipitation);

    this.units.system = hasImperialUnit ? "imperial" : "metric";
  }

  changeToImperialSystem() {
    this.units.temperature = "fahrenheit";
    this.units.windSpeed = "mph";
    this.units.precipitation = "inches";
    this.units.system = "imperial";

    this.uiController.updateUnitsDisplay(this.units);

    if (this.weatherData && this.lastLocation) {
      this.uiController.updateWeatherDisplay(
        this.lastLocation,
        this.weatherData
      );
    }
  }

  changeUnits(unitType, value) {
    this.units[unitType] = value;
    this.determineSystem();

    if (this.weatherData && this.lastLocation) {
      this.uiController.updateWeatherDisplay(
        this.lastLocation,
        this.weatherData
      );
    }
    this.uiController.updateUnitsDisplay(this.units);
  }

  handleRetry() {
    window.location.reload();
  }
}

// Class que gerencia a API do clima
class WeatherAPI {
  constructor() {
    this.baseURL = "https://api.open-meteo.com/v1/forecast";
  }

  async getWeather(latitude, longitude) {
    const params = new URLSearchParams({
      latitude: latitude,
      longitude: longitude,
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      hourly: "temperature_2m,weather_code",
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code,rain",
      timezone: "auto",
      forecast_days: 7,
    });

    const response = await fetch(`${this.baseURL}?${params}`);

    if (!response.ok) throw new Error(`Erro HTPP:, ${response.status}`);

    const data = await response.json();
    return data;
  }
}

class LocationService {
  constructor() {
    this.baseURL = "https://geocoding-api.open-meteo.com/v1/search";
  }

  async getLocation(location) {
    try {
      const response = await fetch(
        `${this.baseURL}?name=${location}&language=en&format=json`
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.ok}`);
      }

      const data = await response.json();

      if (!data || !data.results || data.results.length === 0) {
        return null;
      }

      const resultData = data.results[0];

      return {
        name: resultData.name,
        latitude: resultData.latitude,
        longitude: resultData.longitude,
        admin1: resultData.admin1,
      };
    } catch (error) {
      console.error("Erro na API de geocoding:", error);
      throw error;
    }
  }
}

class UIController {
  constructor(weatherApp) {
    this.weatherApp = weatherApp;
    this.elements = this.getElements();
    this.dateFormatter = new DateFormatter();
    this.weatherIcons = new WeatherIcons();
    this.selectedDay = 0;
  }

  getElements() {
    return {
      dropdownBtnUnits: document.getElementById("dropdown-btn-units"),
      dropdownMenuUnits: document.getElementById("dropdown-menu-units"),
      dropdownBtnDays: document.getElementById("dropdown-btn-days"),
      dropdownMenuDays: document.getElementById("dropdown-menu-days"),

      form: document.querySelector(".form"),
      inputElement: document.getElementById("form-input"),

      currentWeather: document.querySelector(".current-weather"),
      weatherDetails: document.querySelectorAll(".weather-details__item"),
      dailyForecast: document.querySelectorAll(".daily-forecast__item"),
      hourlyForecast: document.querySelectorAll(".hourly-forecast__item"),
      searchLoader: document.querySelector(".search-progress"),

      mainContainer: document.querySelector(".main-container"),
      mainContent: document.querySelector(".main-content"),
      messageNoResults: document.querySelector(".no-results"),
      errorMessage: document.querySelector(".error"),
      tryAgainButton: document.getElementById("btn-try-again"),
      title: document.querySelector(".title"),
      initialMessage: document.querySelector(".initial-message"),
    };
  }

  bindEvents() {
    // Evento de busca
    this.elements.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const searchValue = this.elements.inputElement?.value.trim();
      if (!searchValue) return;

      this.hideInitialMessage();

      this.weatherApp.handleSearch(searchValue);
      this.elements.inputElement.value = "";
    });

    this.elements.tryAgainButton?.addEventListener("click", () => {
      this.weatherApp.handleRetry();
    });

    this.elements.dropdownMenuUnits?.addEventListener("click", (e) => {
      const option = e.target.closest(".dropdown__option");
      if (!option) return;

      const value = option.dataset.value;

      if (value === "imperial") {
        this.weatherApp.changeToImperialSystem();
        this.toggleDropdown("units");
        return;
      }

      let category = null;
      if (value === "celsius" || value === "fahrenheit") {
        category = "temperature";
      } else if (value === "kmh" || value === "mph") {
        category = "windSpeed";
      } else if (value === "mm" || value === "inches") {
        category = "precipitation";
      }

      if (category) {
        this.weatherApp.changeUnits(category, value);
        this.toggleDropdown("units");
      }
    });

    // Eventos dos dropdowns
    this.elements.dropdownBtnUnits?.addEventListener("click", () => {
      this.toggleDropdown("units");
    });

    this.elements.dropdownBtnDays?.addEventListener("click", () => {
      this.toggleDropdown("days");
    });
  }

  showInitialState() {
    this.elements.mainContent?.classList.add("hidden");
    this.elements.initialMessage?.classList.add("active");
  }

  hideInitialMessage() {
    this.elements.initialMessage?.classList.remove("active");
    this.elements.mainContent?.classList.remove("hidden");
  }

  updateUnitsDisplay(units) {
    this.updateDropdownSelections(units);
    this.updateUnitsSymbols(units);
  }

  updateDropdownSelections(units) {
    const options =
      this.elements.dropdownMenuUnits?.querySelectorAll(".dropdown__option");
    if (!options) return;

    options.forEach((option) => {
      const value = option.dataset.value;
      const isSelected =
        value === units.temperature ||
        value === units.windSpeed ||
        value === units.precipitation;

      option.classList.toggle("dropdown__option--selected", isSelected);
    });
  }

  updateUnitsSymbols(units) {
    const windSymbols = document.querySelector(".wind-symbol");
    const precipSymbols = document.querySelector(".precip-symbol");

    if (windSymbols) {
      windSymbols.textContent = units.windSpeed === "mph" ? "mph" : "km/h";
    }
    if (precipSymbols) {
      precipSymbols.textContent =
        units.precipitation === "inches" ? "in" : "mm";
    }
  }

  convertTemperature(celsius, targetUnit) {
    if (targetUnit === "fahrenheit") {
      return (celsius * 9) / 5 + 32;
    }
    return celsius;
  }

  convertWindSpeed(kmh, targetUnit) {
    if (targetUnit === "mph") {
      return kmh * 0.621371;
    }
    return kmh;
  }

  convertPrecipitation(mm, targetUnit) {
    if (targetUnit === "inches") {
      return mm * 0.0393701;
    }
    return mm;
  }

  updateWeatherDisplay(loaction, weatherData) {
    this.updateCurrentWeather(loaction, weatherData);
    this.updateWeatherDetails(weatherData.current);
    this.updateDailyForecast(weatherData.daily);
    this.addDaysToDropdown(weatherData.daily);
    this.updateHourlyForecast(weatherData.hourly, this.selectedDay);
  }

  updateCurrentWeather(location, weatherData) {
    const cityElement = document.getElementById("weather-city");
    const countryElement = document.getElementById("weather-country");
    const dateElement = document.getElementById("current-date");
    const tempElement = document.getElementById("current-temp");
    const iconElement = document.getElementById("current-icon");

    if (cityElement) cityElement.textContent = location.name;
    if (countryElement) countryElement.textContent = location.admin1;
    if (dateElement)
      dateElement.textContent = this.dateFormatter.formatCurrentDate();

    if (weatherData?.current && tempElement) {
      const temp = this.convertTemperature(
        weatherData.current.temperature_2m,
        this.weatherApp.units.temperature
      );

      tempElement.textContent = `${Math.round(temp)}°`;
    }

    if (iconElement) {
      const iconPath = this.weatherIcons.getIcon(
        weatherData.current.weather_code
      );
      iconElement.src = iconPath;
      iconElement.alt = `Clima ${weatherData.current.weather_code}`;
    }
  }

  updateWeatherDetails(currentData) {
    const feelsElement = document.getElementById("feels-like-value");
    const humidityElement = document.getElementById("humidity-value");
    const windSpeedElement = document.getElementById("wind-speed");
    const precipitationElement = document.getElementById("precipitation-value");

    if (feelsElement) {
      const temp = this.convertTemperature(
        currentData.apparent_temperature,
        this.weatherApp.units.temperature
      );
      feelsElement.textContent = `${Math.round(temp)}°`;
    }

    if (humidityElement) {
      humidityElement.textContent = `${currentData.relative_humidity_2m}%`;
    }

    if (windSpeedElement) {
      const speed = this.convertWindSpeed(
        currentData.wind_speed_10m,
        this.weatherApp.units.windSpeed
      );
      const unit = this.weatherApp.units.windSpeed === "mph" ? " mph" : " km/h";
      windSpeedElement.textContent = `${Math.round(speed)} ${unit}`;
    }

    if (precipitationElement) {
      const precip = this.convertPrecipitation(
        currentData.precipitation,
        this.weatherApp.units.precipitation
      );
      const unit =
        this.weatherApp.units.precipitation === "inches" ? " in" : " mm";

      precipitationElement.textContent = `${precip} ${unit}`;
    }
  }

  updateDailyForecast(dailyData) {
    const dailysItems = this.elements.dailyForecast;
    const daysToShow = Math.min(dailyData.time.length, dailysItems.length);

    for (let i = 0; i < daysToShow; i++) {
      const dayItem = dailysItems[i];

      const dayElement = dayItem.querySelector(".daily-forecast__day");
      const iconElement = dayItem.querySelector(".daily-forecast__icon");
      const tempMaxElement = dayItem.querySelector(".daily-forecast__temp-max");
      const tempMinElement = dayItem.querySelector(".daily-forecast__temp-min");

      if (dayElement) {
        dayElement.textContent = this.dateFormatter.getShortDayName(
          dailyData.time[i]
        );
      }
      if (iconElement) {
        const iconPath = this.weatherIcons.getIcon(dailyData.weather_code[i]);
        iconElement.src = iconPath;
        iconElement.alt = `Clima ${dailyData.weather_code[i]}`;
      }
      if (tempMaxElement) {
        const tempMax = this.convertTemperature(
          dailyData.temperature_2m_max[i],
          this.weatherApp.units.temperature
        );
        tempMaxElement.textContent = `${Math.round(tempMax)}°`;
      }
      if (tempMinElement) {
        const tempMin = this.convertTemperature(
          dailyData.temperature_2m_min[i],
          this.weatherApp.units.temperature
        );
        tempMinElement.textContent = `${Math.round(tempMin)}°`;
      }
    }
  }

  addDaysToDropdown(dailyData) {
    const selectedDayText = document.getElementById("selected-day-text");
    if (!this.elements.dropdownMenuDays) return;

    this.elements.dropdownMenuDays.innerHTML = "";

    if (selectedDayText && dailyData.time[this.selectedDay]) {
      selectedDayText.textContent = this.dateFormatter.getDayName(
        dailyData.time[this.selectedDay]
      );
    }

    dailyData.time.forEach((date, index) => {
      const option = document.createElement("div");

      option.className = `dropdown__option ${
        index === this.selectedDay ? "dropdown__option--selected" : ""
      }`;

      option.textContent = this.dateFormatter.getDayName(date);
      option.setAttribute("data-day-index", index);

      option.addEventListener("click", () => {
        this.selectedDay = index;
        this.weatherApp.handleDaySelect(index);
        this.updateSelectedDay(this.dateFormatter.getDayName(date));
        this.toggleDropdown("days");
      });

      this.elements.dropdownMenuDays.appendChild(option);
    });
  }

  updateSelectedDay(dayName) {
    const selectedDayText = document.getElementById("selected-day-text");
    if (selectedDayText) {
      selectedDayText.textContent = dayName;
    }

    const options =
      this.elements.dropdownMenuDays.querySelectorAll(".dropdown__option");
    options.forEach((option, index) => {
      option.classList.toggle(
        "dropdown__option--selected",
        index === this.selectedDay
      );
    });
  }

  updateHourlyForecast(hourlyData, selectedDay = 0) {
    const container = document.getElementById("hourly-container");
    if (!container) return;

    container.innerHTML = "";

    const hoursPerDay = 24;
    const startIndex = selectedDay * hoursPerDay;
    const endIndex = startIndex + hoursPerDay;

    const dailyHours = hourlyData.time.slice(startIndex, endIndex);
    const dailyTemperatures = hourlyData.temperature_2m.slice(
      startIndex,
      endIndex
    );
    const dailyWeatherCodes = hourlyData.weather_code.slice(
      startIndex,
      endIndex
    );

    const now = new Date();
    const currentHour = now.getHours();

    // Encontra o indice da proxima hora
    let startHourIndex = 0;
    if (selectedDay === 0) {
      for (let i = 0; i < dailyHours.length; i++) {
        const hourTime = new Date(dailyHours[i]);
        if (hourTime.getHours() > currentHour) {
          startHourIndex = i;
          break;
        }
      }
    }

    const hoursToDisplay = selectedDay === 0 ? 12 : 24;
    const endDisplayIndex = Math.min(
      startHourIndex + hoursToDisplay,
      dailyHours.length
    );

    for (let i = startHourIndex; i < endDisplayIndex; i++) {
      const hourTime = new Date(dailyHours[i]);
      const formattedTime = hourTime.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const temp = this.convertTemperature(
        dailyTemperatures[i],
        this.weatherApp.units.temperature
      );

      const hourItem = document.createElement("div");
      hourItem.className = "hourly-forecast__item";
      hourItem.innerHTML = `
      <div class="hourly-forecast__time-group">
        <img src="${this.weatherIcons.getIcon(dailyWeatherCodes[i])}"
          class="hourly-forecast__icon"
          alt="Icone do Clima"
        />
        <p class="hourly-forecast__time">${formattedTime}</p>
      </div>
        <p class="hourly-forecast__temp">${Math.round(temp)}°</p>
      `;

      container.appendChild(hourItem);
    }
  }

  showAllLoading() {
    this.showWeatherLoading();
    this.showWeatherDetailsLoading();
    this.showDailyForecastLoading();
    this.showHourlyForecastLoading();
  }

  hideAllLoading() {
    this.hideWeatherLoading();
    this.hideWeatherDetailsLoading();
    this.hideDailyForecastLoading();
    this.hideHourlyForecastLoading();
  }

  showWeatherLoading() {
    this.elements.currentWeather?.classList.add("loading");
  }

  hideWeatherLoading() {
    this.elements.currentWeather?.classList.remove("loading");
  }

  showWeatherDetailsLoading() {
    this.elements.weatherDetails.forEach((item) => {
      item.classList.add("loading-item");
    });
  }

  hideWeatherDetailsLoading() {
    this.elements.weatherDetails.forEach((item) => {
      item.classList.remove("loading-item");
    });
  }

  showDailyForecastLoading() {
    this.elements.dailyForecast.forEach((item) => {
      item.classList.add("loading-item");
    });
  }

  hideDailyForecastLoading() {
    this.elements.dailyForecast?.forEach((item) => {
      item.classList.remove("loading-item");
    });
  }

  showHourlyForecastLoading() {
    this.elements.hourlyForecast.forEach((item) => {
      item.classList.add("loading-item");
    });
  }

  hideHourlyForecastLoading() {
    this.elements.hourlyForecast.forEach((item) => {
      item.classList.remove("loading-item");
    });
  }

  showNoResult() {
    this.elements.mainContent?.classList.add("hidden");
    this.elements.messageNoResults?.classList.add("active");
  }

  showError() {
    this.elements.errorMessage?.classList.add("active");
    this.elements.mainContainer?.classList.add("hidden");
    this.elements.title?.classList.add("hidden");
  }

  showSearchLoader() {
    setTimeout(() => {
      this.elements.searchLoader?.classList.add("active");
    }, 100);
  }

  hideSearchLoader() {
    this.elements.searchLoader?.classList.remove("active");
  }

  toggleDropdown(type) {
    if (type === "units") {
      this.elements.dropdownMenuUnits.classList.toggle("active");
    } else if (type === "days") {
      this.elements.dropdownMenuDays.classList.toggle("active");
    }
  }
}

class DateFormatter {
  formatCurrentDate() {
    const date = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    };

    return date.toLocaleDateString("pt-BR", options);
  }

  getShortDayName(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    return date.toLocaleDateString("pt-BR", {
      weekday: "short",
      timeZone: "UTC",
    });
  }

  getDayName(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      timeZone: "UTC",
    });
  }
}

class WeatherIcons {
  constructor() {
    this.iconMap = {
      0: "assets/images/icon-sunny.webp",
      1: "assets/images/icon-sunny.webp",
      2: "assets/images/icon-partly-cloudy.webp",
      3: "assets/images/icon-overcast.webp",
      45: "assets/images/icon-fog.webp",
      48: "assets/images/icon-fog.webp",
      51: "assets/images/icon-drizzle.webp",
      53: "assets/images/icon-drizzle.webp",
      55: "assets/images/icon-drizzle.webp",
      61: "assets/images/icon-rain.webp",
      63: "assets/images/icon-rain.webp",
      65: "assets/images/icon-rain.webp",
      71: "assets/images/icon-snow.webp",
      73: "assets/images/icon-snow.webp",
      75: "assets/images/icon-snow.webp",
      77: "assets/images/icon-snow.webp",
      80: "assets/images/icon-rain.webp",
      81: "assets/images/icon-rain.webp",
      82: "assets/images/icon-rain.webp",
      85: "assets/images/icon-snow.webp",
      86: "assets/images/icon-snow.webp",
      95: "assets/images/icon-storm.webp",
      96: "assets/images/icon-storm.webp",
      99: "assets/images/icon-storm.webp",
    };
  }

  getIcon(weatherCode) {
    return this.iconMap[weatherCode] || "assets/images/icon-sunny.webp";
  }
}

const app = new WeatherApp();
app.init();
