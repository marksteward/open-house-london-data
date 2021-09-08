(async () => {
  const year = '2021';

  const getListingsUrl = () => {
    const date = document.forms.filter.date.value;
    return `maps/${year}/geojson/${date}.geojson`;
  };

  const getListingsFilter = () => {
    const filter = ['all', ['literal', true]];
    switch (document.forms.filter.ticketed_events.value) {
      case 'yes': filter.push(['==', ['get', 'ticketed_events'], 'Yes']); break;
      case 'no': filter.push(['==', ['get', 'ticketed_events'], 'No']); break;
    }
    switch (document.forms.filter.fully_booked.value) {
      case 'yes': filter.push(['in', ['get', 'fully_booked'], ['literal', ['Yes', 'Unknown']]]); break;
      /* If ticketed_events is No, fully_booked will be "", which we want to
       * include here. If the ticketed_events filter is set to yes, we won't
       * see any ambiguous events anyway. */
      case 'no': filter.push(['in', ['get', 'fully_booked'], ['literal', ['No', 'Unknown', '']]]); break;
    }
    return filter;
  };

  const updateListings = async () => {
    await mapReady;
    map.getSource('listings').setData(getListingsUrl());
    const filter = getListingsFilter();
    map.setFilter('listings-labels', filter);
    map.setFilter('listings-markers', filter);
    saveFilter();
  };

  const saveFilter = () => {
    const hash = new URLSearchParams(document.location.hash.substr(1));
    const date = document.forms.filter.date.value;
    const ticketed_events = document.forms.filter.ticketed_events.value;
    const fully_booked = document.forms.filter.fully_booked.value;
    hash.set('filter', `${date}/${ticketed_events}/${fully_booked}`);
    document.location.hash = '#' + hash.toString().replaceAll('%2F', '/');
  };

  const loadFilter = () => {
    const hash = new URLSearchParams(document.location.hash.substr(1));
    const filter = hash.get('filter');
    if (!filter) return;
    const [date, ticketed_events, fully_booked] = filter.split('/');
    /* These assignments will be ignored if the values are invalid */
    document.forms.filter.date.value = date;
    document.forms.filter.ticketed_events.value = ticketed_events;
    document.forms.filter.fully_booked.value = fully_booked;
  };

  const buildPopupHtml = (feature) => {
    const { name, description, url, fully_booked, ticketed_events } = feature.properties;
    const data = [
      `<dt>Ticketed</dt><dd>${ticketed_events}</dd>`
    ];
    if (ticketed_events == 'Yes') {
      data.push(`<dt>Fully booked</dt><dd>${fully_booked}</dd>`);
    }
    return `
      <a href="${url}">${name}</a>
      <p>${description}</p>
      <dl>${data.join('\n')}</dl>
    `;
  };

  mapboxgl.accessToken = 'pk.eyJ1IjoibXM3ODIxIiwiYSI6ImNrdGFlMTMwMzA5dnYycG15MzhjeXgwa3MifQ.hD7yHtV4jWmf5tige7c2kg';
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    hash: 'map',
    center: [-0.1, 51.52],  // approximately Smithfield
    zoom: 13,
  });
  const mapReady = new Promise((resolve, reject) => {
    map.on('load', () => {
      map.loadImage('mapbox-marker-icon-20px-red.png', (error, data) => {
        if (error) throw error;
        map.addImage('marker', data);
        map.addSource('listings', { type: 'geojson', data: getListingsUrl() });
        map.addLayer({
          'id': 'listings-markers',
          'type': 'symbol',
          'source': 'listings',
          'layout': {
            'icon-image': 'marker',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }
        });
        map.addLayer({
          'id': 'listings-labels',
          'type': 'symbol',
          'source': 'listings',
          'layout': {
            'text-field': ['get', 'name'],
            'text-variable-anchor': ['top'],
            'text-radial-offset': 0.5,
          },
          'paint': {
            'text-halo-color': '#fff',
            'text-halo-width': 1,
            'text-halo-blur': 1,
          },
        });
        resolve();
      });
    });
  });
  map.on('click', 'listings-markers', (e) => {
    const feature = e.features[0];
    const coordinates = [...feature.geometry.coordinates];
    const html = buildPopupHtml(feature);

    // Find the right marker if the map is zoomed out enough to wrap
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(map);

  });
  map.on('mouseenter', 'listings-markers', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'listings-markers', () => map.getCanvas().style.cursor = '');

  const buildDates = async (dateChooser) => {
    const resp = await fetch(`maps/${year}/dates.json`);
    const dates = await resp.json();
    const els = [];
    const now = new Date();
    for (const date of dates) {
      if (date == 'all_week') continue;
      const dt = new Date(date);
      if (dt < now) continue;
      const mm_dd = `${dt.getDate()}/${dt.getMonth() + 1}`;
      const day = dt.toLocaleString('en-GB', {weekday: 'short'});
      els.push(`<input type="radio" value="${date}" id="date-${date}" name="date"><label for="date-${date}">${mm_dd} <small>${day}</small></label>`);
    }
    dateChooser.insertAdjacentHTML('afterbegin', els.join(''));
    document.body.classList.remove('not-ready');
  };

  document.forms.filter.addEventListener('click', (e) => {
    if (e.target.closest('input')) updateListings();
  });

  await buildDates(document.getElementById('date'));
  loadFilter();
  updateListings();

})();
