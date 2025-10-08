from openai import OpenAI
import os
from dotenv import load_dotenv
import json
import urllib.request
import urllib.parse
import re
import ssl
import certifi

# Load variables from .env if present
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError(
        "OPENAI_API_KEY est manquante. Exportez-la avant d'exécuter: export OPENAI_API_KEY=\"VOTRE_CLE\""
    )
client = OpenAI(api_key=api_key)

def get_weather(location: str) -> dict:
    """Return current temperature (°C) and weather_code using Open-Meteo APIs (no key required)."""
    # Use certifi CA bundle to avoid SSL: CERTIFICATE_VERIFY_FAILED on macOS
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    query = urllib.parse.urlencode({"name": location, "count": 1, "language": "en", "format": "json"})
    with urllib.request.urlopen(f"https://geocoding-api.open-meteo.com/v1/search?{query}", context=ssl_context) as r:
        geo = json.loads(r.read().decode("utf-8"))
    if not geo or not geo.get("results"):
        return {"location": location, "error": "Location not found"}
    place = geo["results"][0]
    lat, lon = place["latitude"], place["longitude"]
    with urllib.request.urlopen(
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code",
        context=ssl_context,
    ) as r2:
        data = json.loads(r2.read().decode("utf-8"))
    current = data.get("current", {})
    return {
        "location": f"{place.get('name')}, {place.get('country_code')}",
        "latitude": lat,
        "longitude": lon,
        "temperature_c": current.get("temperature_2m"),
        "weather_code": current.get("weather_code"),
    }

tools = [
    {
        "type": "function",
        "name": "get_weather",
        "description": "Get current temperature (°C) and weather code for a location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and country (e.g., Paris, France), don't write today",
                }
            },
            "required": ["location"],
            "additionalProperties": False,
        },
        "strict": True,
    }
]

user_question = "What is the weather like in Paris today?"

# Execute the weather tool locally first (works without OpenAI key)
match = re.search(r"in\s+([^?.,]+)", user_question)
location = match.group(1).strip() if match else "Paris, France"
location = re.sub(r"\b(today|now|tomorrow)\b", "", location, flags=re.I).strip(" ,")
if not location:
    location = "Paris, France"
tool_result = get_weather(location)

# Present the weather as a readable sentence
def describe_weather(result: dict) -> str:
    code = result.get("weather_code")
    descriptions = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "fog",
        48: "depositing rime fog",
        51: "light drizzle",
        53: "moderate drizzle",
        55: "dense drizzle",
        61: "slight rain",
        63: "moderate rain",
        65: "heavy rain",
        71: "slight snow",
        73: "moderate snow",
        75: "heavy snow",
        80: "rain showers",
        81: "heavy rain showers",
        82: "violent rain showers",
        95: "thunderstorm",
        96: "thunderstorm with slight hail",
        99: "thunderstorm with heavy hail",
    }
    where = result.get("location", location)
    temp = result.get("temperature_c")
    desc = descriptions.get(code, "unknown conditions")
    if temp is None:
        return f"Weather in {where}: {desc}."
    return f"In {where}, it is {temp}°C with {desc}."

print(describe_weather(tool_result))

# Keep the raw JSON for debugging if needed
# print(json.dumps({"tool": "get_weather", "args": {"location": location}, "result": tool_result}, indent=2))

# Then try the model call; if API key is invalid, don't crash
try:
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {"role": "user", "content": user_question},
        ],
        tools=tools,
    )
    print(response.output_text)
except Exception as e:
    print(f"[Model call skipped] {e}")

    