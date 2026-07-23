const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

export async function searchPlaces(query: string) {
    if (!query.trim()) return [];

    const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            query
        )}&limit=5&apiKey=${API_KEY}`
    );

    const data = await response.json();

    return data.features;
}