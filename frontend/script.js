const apiKey = 'abc'; // 🔑 Replace with your OpenRouteService API key


const map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let markerGroup = L.layerGroup().addTo(map);

async function getCoordinates(city) {
    const response = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${city}`);
    const data = await response.json();
    const coords = data.features[0].geometry.coordinates;
    return [coords[1], coords[0]]; // [lat, lon]
}

async function findRoute() {
    const source = document.getElementById('source').value.trim();
    const destination = document.getElementById('destination').value.trim();

    document.getElementById('status').innerText = 'Finding route...';

    try {
        const response = await fetch('http://127.0.0.1:5000/find_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Unknown error');
        }

        const result = await response.json();
        document.getElementById('status').innerText = `Path: ${result.path.join(' → ')}, Distance: ${result.distance} km`;

        markerGroup.clearLayers();
        const coordsList = [];

        for (const city of result.path) {
            const coords = await getCoordinates(city);
            coordsList.push([coords[1], coords[0]]); // [lon, lat] for ORS API
            L.marker(coords).addTo(markerGroup).bindPopup(city);
        }

        // Request road route from ORS Directions API
        const orsResponse = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
            method: "POST",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: coordsList,
                format: "geojson"
            })
        });

        const geojson = await orsResponse.json();

        L.geoJSON(geojson, {
            style: { color: 'blue', weight: 4 }
        }).addTo(markerGroup);

        // ✅ FIXED: Proper way to compute bounds from coordinates
        const latLngList = coordsList.map(([lon, lat]) => [lat, lon]);
        const bounds = L.latLngBounds(latLngList);
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });

    } catch (err) {
        console.error(err);
        document.getElementById('status').innerText = `Failed: ${err.message}`;
    }
}
