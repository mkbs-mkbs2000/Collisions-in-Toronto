// Define access token
mapboxgl.accessToken = 'pk.eyJ1IjoibXVoYW1tYWRraGFsaXMyMDAwIiwiYSI6ImNtNmllbGt4cjA3cGwycXEyaHA0bDcycWwifQ.hrpqSf6zeg2T5GCfRlygWg';

// Initialize map and edit to your preference
const map = new mapboxgl.Map({
    container: 'map', // container id in HTML
    style: 'mapbox://styles/muhammadkhalis2000/cm6yk8amv00kb01s16rkt56d2',  // ****ADD MAP STYLE HERE *****
    center: [-79.38379609087877, 43.72014961698346],  // starting point, longitude/latitude
    zoom: 10 // starting zoom level
});

let pedcyc
const pedcycLookup = {};

fetch('https://raw.githubusercontent.com/mkbs-mkbs2000/Collisions-in-Toronto/refs/heads/main/data/pedcyc_collision_06-21.geojson')
    .then(response => response.json())
    .then(response => {
        pedcyc = response;
        pedcyc.features.forEach(feature => {
            pedcycLookup[feature.properties._id] = feature;
    });
});

map.on('load', () => {

    var polygon = turf.envelope(pedcyc);
    var rescaled = turf.transformScale(polygon, 1.05);
    var hexgrid = turf.hexGrid(
        [
            rescaled.geometry.coordinates[0][0][0],
            rescaled.geometry.coordinates[0][0][1],
            rescaled.geometry.coordinates[0][2][0],
            rescaled.geometry.coordinates[0][2][1]
        ],
        0.5, {units: 'kilometers'});

    let overall = turf.collect(hexgrid, pedcyc, '_id', 'collisions');
    console.log(overall);

    let maxtotal = 0;
    let maxmajor = 0;
    let maxfatal = 0;

    overall.features.forEach(feature => {

        feature.properties.COUNT = feature.properties.collisions.length;

        feature.properties.NONE = 0;
        feature.properties.MINOR = 0;
        feature.properties.MAJOR = 0;
        feature.properties.FATAL = 0;

        feature.properties.collisions = feature.properties.collisions.map(id => pedcycLookup[id]);

        feature.properties.collisions.forEach(collision => {
            if (collision.properties.INJURY == 'Major') {
                feature.properties.MAJOR++;
            } else if (collision.properties.INJURY == 'Fatal') {
                feature.properties.FATAL++;
            }
        });

        if (feature.properties.COUNT > maxtotal) {
            maxtotal = feature.properties.COUNT;
        };
        if (feature.properties.MAJOR > maxmajor) {
            maxmajor = feature.properties.MAJOR;
        };
        if (feature.properties.FATAL > maxfatal) {
            maxfatal = feature.properties.FATAL;
        };

    });

    console.log(
        'Max Overall: ' + maxtotal,
        'Max Major Injury: ' + maxmajor,
        'Max Fatal Injury: ' + maxfatal
    );

    map.addSource('overall', {
        type: 'geojson',
        data: overall
    });

    map.addLayer({
        'id': 'overall',
        'type': 'fill',
        'source': 'overall',
        paint: {
            'fill-color': [
                'case',
                ['==', ['get', 'COUNT'], 0], 'rgba(0,0,0,0)',
                ['step', ['get', 'COUNT'],
                '#FF8888', 30,
                '#F43030', 60,
                '#C60000']
            ],
            'fill-opacity': 0.6
        }
    });

});