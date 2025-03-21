// Define access token
mapboxgl.accessToken = 'pk.eyJ1IjoibXVoYW1tYWRraGFsaXMyMDAwIiwiYSI6ImNtNmllbGt4cjA3cGwycXEyaHA0bDcycWwifQ.hrpqSf6zeg2T5GCfRlygWg';

// Initialize map and edit to your preference
const map = new mapboxgl.Map({
    container: 'map', // container id in HTML
    style: 'mapbox://styles/muhammadkhalis2000/cm6yk8amv00kb01s16rkt56d2',  // ****ADD MAP STYLE HERE *****
    center: [-79.38379609087877, 43.72014961698346],  // starting point, longitude/latitude
    zoom: 10 // starting zoom level
});

let pedcyc  // Declaring accident data variable
const pedcycLookup = {};  // Declaring accident lookup variable

fetch('https://raw.githubusercontent.com/mkbs-mkbs2000/Collisions-in-Toronto/refs/heads/main/data/pedcyc_collision_06-21.geojson')
    .then(response => response.json())  // Converting fetched data into JSON
    .then(response => {
        pedcyc = response;  // Assigning fetched data to pedcyc variable
        pedcyc.features.forEach(feature => {
            pedcycLookup[feature.properties._id] = feature;  // Assigning the id to be the key of the lookup
    });
});

map.on('load', () => {

    var polygon = turf.envelope(pedcyc);  // Used the envelope function to create a bounding box around the data
    var rescaled = turf.transformScale(polygon, 1.05);  // Rescaled the bounding box polygon by 5%
    var hexgrid = turf.hexGrid(
        [
            rescaled.geometry.coordinates[0][0][0],
            rescaled.geometry.coordinates[0][0][1],
            rescaled.geometry.coordinates[0][2][0],
            rescaled.geometry.coordinates[0][2][1]
        ],
        0.5, {units: 'kilometers'});

    let overall = turf.collect(hexgrid, pedcyc, '_id', 'collisions');  // Collecting accident data into the hexgrid

    // Iterating over each hexagon grid
    overall.features.forEach(feature => {

        feature.properties.COUNT = feature.properties.collisions.length;  // Calculating total number of accidents in each hexgrid
        feature.properties.MAJOR = 0;  // Initialising accidents classified as major as 0
        feature.properties.FATAL = 0;  // Initialising accidents classified as fatal as 0

        // Mapping the array of accidents ID data in each hexgrid to the accidents data using the lookup variable
        feature.properties.collisions = feature.properties.collisions.map(id => pedcycLookup[id]);

        // For each accident ID in a hexgrid, look at the INJURY classification in the accident data
        feature.properties.collisions.forEach(collision => {
            if (collision.properties.INJURY == 'Major') {
                feature.properties.MAJOR++;  // If INJURY is classified as Major, increase by 1
            } else if (collision.properties.INJURY == 'Fatal') {
                feature.properties.FATAL++;  // If INJURY is classified as Fatal, increase by 1
            }
        });
    });

    // Mapping the array of hexgrids to get the array of COUNT, MAJOR, and FATAL data
    // Filter out any 0s in the data
    const counts = overall.features
    .map(feature => feature.properties.COUNT)
    .filter(value => value !== 0);

    const majors = overall.features
    .map(feature => feature.properties.MAJOR)
    .filter(value => value !== 0);

    const fatals = overall.features
    .map(feature => feature.properties.FATAL)
    .filter(value => value !== 0);
    
    // Calculate quartile and jenks breaks using simple-statistics library
    // Documentation (Jenks): https://simple-statistics.github.io/docs/#jenks
    // To be logged so that I can make the customised step functions below
    console.log('Jenk COUNT:', ss.jenks(counts, 3));
    console.log('Jenk MAJOR:', ss.jenks(majors, 3));
    console.log('Jenk FATAL:', ss.jenks(fatals, 3));

    // adding the hexgrid layer
    map.addSource('overall', {
        type: 'geojson',
        data: overall
    });

    // initialising the layer to simply have an opacity of 0.6
    // filter out any hexgrid without any accidents in it
    map.addLayer({
        'id': 'overall',
        'type': 'fill',
        'source': 'overall',
        'filter': ['!=', ['get', 'COUNT'], 0],
        paint: {
            'fill-opacity': 0.6
        }
    });

     // Initialising the filter to show total accidents layer and legend at first
    filterTotal();
    document.getElementById('total').style.display = 'block';

    changeCheckbox();

    // adding navigation controls
    map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'top-right');

    // When map loads, popup message to inform readers how to use the website, toggling between points and returning to default extent
    const welcomeModal = new bootstrap.Modal(document.getElementById('welcomeModal'));
    welcomeModal.show();

});

// Entire function that informs changes in checkboxes, layers and legends based on which checkbox that the user clicks afterwards
function changeCheckbox() {
    document.getElementById('layer_selection').addEventListener('change', function(event) {
        
        // Get the target checkbox that was clicked
        const target = event.target;
    
        // Ensure the event is triggered by a checkbox
        if (target.type == 'checkbox') {

            // Uncheck all other checkboxes
            document.querySelectorAll('#layer_selection input[type="checkbox"]').forEach(checkbox => {
                if (checkbox != target) {
                    checkbox.checked = false;
                }
            });
    
            // Show the corresponding layer and legend based on the checked checkbox
            if (target.id == 'totalacc') {
                filterTotal();
                document.getElementById('total').style.display = 'block';
                document.getElementById('major').style.display = 'none';
                document.getElementById('fatal').style.display = 'none';
            } else if (target.id == 'majoracc') {
                filterMajor();
                document.getElementById('total').style.display = 'none';
                document.getElementById('major').style.display = 'block';
                document.getElementById('fatal').style.display = 'none';
            } else if (target.id == 'fatalacc') {
                filterFatal();
                document.getElementById('total').style.display = 'none';
                document.getElementById('major').style.display = 'none';
                document.getElementById('fatal').style.display = 'block';
            }
        }
    });
};

function filterTotal() {
    map.setPaintProperty('overall', 'fill-color', [

        // Classify based on jenks distribution
        'step', ['get', 'COUNT'],
        '#fbc4ab', 2,
        '#f08080', 9,
        '#ff0000', 27,
        '#300000'
    ]);
};

function filterMajor() {
    map.setPaintProperty('overall', 'fill-color', [
        'case',

        // If only MAJOR is 0, set it to light grey
        ['all',
            ['!=', ['get', 'COUNT'], 0],
            ['==', ['get', 'MAJOR'], 0],
            ['!=', ['get', 'FATAL'], 0],
        ], '#9e9e9e',

        // Classify based on jenks distribution
        ['step', ['get', 'MAJOR'],
        '#fbc4ab', 2,
        '#f08080', 8,
        '#ff0000', 22,
        '#300000']
    ]);
};

function filterFatal() {
    map.setPaintProperty('overall', 'fill-color', [
        'case',

        // If only FATAL is 0, set it to light grey
        ['all',
            ['!=', ['get', 'COUNT'], 0],
            ['!=', ['get', 'MAJOR'], 0],
            ['==', ['get', 'FATAL'], 0],
        ], '#9e9e9e',

        // Classify based on jenks distribution
        ['step', ['get', 'FATAL'],
        '#fbc4ab', 2,
        '#f08080', 3,
        '#ff0000', 5,
        '#300000']
    ]);
};

// Initialising popup button
const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

// When the mouse hovers/move over a hexagon, the popup will appear
map.on('mousemove', 'overall', (e) => {

    // The mouse cursor changes to a pointer when hovering over a hexagon
    map.getCanvas().style.cursor = 'pointer';

    // Extracting the feature of the hexagon and calculating the centroid of the hexagon (for the popup to be displayed)
    const hexFeature = e.features[0];
    const centroid = turf.centroid(hexFeature);
    const coordinates = centroid.geometry.coordinates;

    // Extracting description to be shown in the popup and the coordinates where the popup will be displayed
    const description = 'Total Accident Count: ' + e.features[0].properties.COUNT + '<br>' + 
    'Accidents with Major Injuries: ' + e.features[0].properties.MAJOR + '<br>' +
    'Fatal Injuries: ' + e.features[0].properties.FATAL;

    // Pushing the popup on to the map with the description at the specific coordinates, as have been respectively initialised above
    popup
        .setLngLat(coordinates)
        .setHTML(description)
        .addTo(map);
});

// When the mouse leaves, the pointer reverts back to normal mouse cursor and the popup disappears
map.on('mouseleave', 'overall', () => {
    map.getCanvas().style.cursor = '';

    popup.remove();
});