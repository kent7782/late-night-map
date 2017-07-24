(function (window, document) {
  var map, service;
  var startPosition = { lat: 37.9, lng: -122.9 };
  var locatingIsDisabled = false;
  var keyword, prevKeyword;
  var pin, infoWindow, currentMarker, currentPosition;
  var placeMarkers = [],
      placeDetails = {},
      placeIds = {},
      defaultIcon = {};
  var date = new Date(),
      today = date.getDay(),
      hour = date.getHours();
  var searchForm = document.getElementById('search-form'),
      searchBox = document.getElementById('search-box'),
      searchBtn = document.getElementById('search-btn'),
      locateBtn = document.getElementById('locate-btn'),
      messageLabel = document.getElementById('message');

  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: startPosition,
      zoom: 9,
      mapTypeControl: false,
      styles: initialStyle,
      draggableCursor:'crosshair',
      disableDoubleClickZoom: true
    });

    defaultIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#FFFFFF',
      fillOpacity: 0.4,
      scale: 9,
      strokeColor: '#212121',
      strokeWeight: 0.2,
    };

    // Prompt the user to enable location detection
    locateUser();

    // Initialize InfoWindow
    infoWindow = new google.maps.InfoWindow();
    service = new google.maps.places.PlacesService(map);

    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      infoWindow.close();
      searchPlaces();
    });

    map.addListener('click', function () {
      infoWindow.close();
    });

    map.addListener('dblclick', function (e) {
      dropPin(e.latLng, map);
      infoWindow.close();
    });

    locateBtn.addEventListener('click', function (event) {
      event.preventDefault();
      infoWindow.close();
      if (locatingIsDisabled) {
        showMessageAndHide('Please enable location tracking on your browser.', 3000);
      } else {
        locateUser();
      }
    });
  }

  function locateUser() {
    // Check whether the current location has already be indentified
    if (currentMarker) {
      repositionMap(currentPosition);
    } else {
      // Check if the browser support HTML5 geolocation
      if (navigator.geolocation) {
        showMessage('Locating..');
        navigator.geolocation.getCurrentPosition(function(position) {
          // Get the current position successfully
          currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          searchPlaces(currentPosition);
          map.setOptions({ styles: mainStyle });
          createCurrentMarker(currentPosition);
        }, function() {
          // Failed to locate or User denied access
          locatingIsDisabled = true;
          map.setOptions({ styles: mainStyle });
          hideMessage();
        });
      } else {
        // Browser doesn't support Geolocation
        showMessageAndHide('Your browser does not support location', 3500);
        map.setOptions({ styles: mainStyle });
      }
    }
  }

  function dropPin(latLng, map) {
    map.panTo(latLng);
    if (pin) {
      pin.setPosition(latLng);
    } else {
      pin = new google.maps.Marker({
        position: latLng,
        icon: modifyIcon(defaultIcon, { fillColor: 'red', scale: 10}),
        map: map
      });
    }
    hideMessage();
  }

  function searchPlaces(searchPosition) {
    keyword = document.getElementById('search-box').value;
    // if the keyword is empty
    if (!keyword) {
      showMessageAndHide('Please enter a keyword.', 2000);
      return;
    }
    // Check if the keyword is new
    if (prevKeyword && prevKeyword !== keyword) {
      clearPlaceMarkers();
    }

    var defaultSearchRange = 150000;
    var placesRequest = {
      location: '',
      radius: defaultSearchRange / map.getZoom(),
      // bounds: map.getBounds(),
      keyword: keyword,
      openNow: true
    };

    // Check if a search location is provided
    if (searchPosition) {
      placesRequest.location = searchPosition;
    } else {
      // Check if there's a pin
      if (pin) {
        var pinPosition = new google.maps.LatLng(pin.getPosition().lat(), pin.getPosition().lng());
        placesRequest.location = pinPosition;
      } else {
        showMessageAndHide('Double-click on the map to drop a pin for searching.', 3500);
        return;
      }
    }

    requestPlaces(placesRequest);
    repositionMap(placesRequest.location);
    prevKeyword = keyword;
  }

  function requestPlaces(request) {
    showMessage('Searching..');
    // Google Places Radar Search
    service.radarSearch(request, function (results, status, nextPage) {
      if (status == google.maps.places.PlacesServiceStatus.OK) {
        displayPlaceMarkers(results);
        showMessageAndHide(results.length + ' "' + keyword + '" places are still open.', 3000);
      } else {
        showMessageAndHide('No place found.. Zoom to another area and try again.', 3500);
      }
    });
  }

  function displayPlaceMarkers(results) {
    for (var i = 0; i < results.length; i++) {
      var place = results[i];
      var coords = place.geometry.location;
      var latLng = new google.maps.LatLng(coords.lat(), coords.lng());

      // Check if the place marker already exists
      if (!placeIds[place.place_id]) {
        createPlaceMarker(latLng, place);
        placeIds[place.place_id] = place;
      }
    }
  }

  function createPlaceMarker(latLng, place) {
    var placeIcon = modifyIcon(defaultIcon, { fillColor: '#FFFF00' });
    var placeHover = modifyIcon(placeIcon, { scale: placeIcon.scale + 3 });
    var marker = new google.maps.Marker({
      position: latLng,
      icon: placeIcon,
      map: map
    });

    placeMarkers.push(marker);

    marker.addListener('mouseover', function () {
      this.setIcon(placeHover);
    });

    marker.addListener('mouseout', function () {
      this.setIcon(placeIcon);
    });

    marker.addListener('click', function() {
      requestPlaceDetail(place.place_id, function (place) {
        openInfoWindow(this, place);
      }.bind(this));
    });
  }

  function createCurrentMarker(currentPosition) {
    var currentIcon = modifyIcon(defaultIcon, { fillColor: 'blue', fillOpacity: 0.3, scale: 10 });
    var currentHover = modifyIcon(currentIcon, { scale: 13 });
    currentMarker = new google.maps.Marker({
      position: currentPosition,
      icon: currentIcon,
      map: map
    });

    currentMarker.addListener('mouseover', function () {
      this.setIcon(currentHover);
    });

    currentMarker.addListener('mouseout', function () {
      this.setIcon(currentIcon);
    });

    currentMarker.addListener('click', function() {
      infoWindow.setContent('<p>You\'re here, in the dark.<p>');
      infoWindow.open(map, this);
    });
  }

  function requestPlaceDetail(id, callback) {
    if (placeDetails[id]) {
      callback(placeDetails[id]);
    } else {
      var detailRequest = {
        placeId: id
      };
      service.getDetails(detailRequest, function (detail, status) {
        callback(detail);
        placeDetails[id] = detail;
      });
    }
  }

  function openInfoWindow(marker, place) {
    var contentString =
    '<div class="info-window">'+
      '<h1 class="info-header">' + place.name + '</h1>'+
      '<div class="info-content">'+
        '<p><b>Address: </b>' + place.formatted_address + '</p>' +
        '<p id="phone"><b>Phone Number: </b>' + place.formatted_phone_number + '</p>' +
        '<p><b>Hours Today: </b>' + place.opening_hours.weekday_text[getAdjustedDayIndex()] + '</p>' +
        '<p id="website"><a href="' + place.website + '" target="_blank">Visit Webstie</a></p>' +
      '</div>'+
    '</div>';
    infoWindow.setContent(contentString);
    infoWindow.open(map, marker);

    if(!place.website) {
      document.getElementById('phone').style.display = 'none';
    }

    if(!place.website) {
      document.getElementById('website').style.display = 'none';
    }
  }

  function showMessage(message) {
    messageLabel.innerHTML = message;
    searchBtn.style.display = 'none';
    searchBox.style.display = 'none';
    locateBtn.style.display = 'none';
    messageLabel.style.display = 'inline-block';
  }

  function hideMessage() {
    searchBtn.style.display = 'inline-block';
    searchBox.style.display = 'inline-block';
    locateBtn.style.display = 'inline-block';
    messageLabel.style.display = 'none';
  }

  function showMessageAndHide(message, time) {
    showMessage(message);
    setTimeout(function () {
      hideMessage();
    }, time);
  }

  function repositionMap(position) {
    map.panTo(position);
    smoothZoom(map, 14, map.getZoom());
  }

  // Zoom to position smoothly
  function smoothZoom (map, max, curr) {
    if (curr >= max) {
      return;
    }
    else {
      z = google.maps.event.addListener(map, 'zoom_changed', function(event){
        google.maps.event.removeListener(z);
        smoothZoom(map, max, curr + 1);
      });
      setTimeout(function () {
        map.setZoom(curr);
      }, 65);
    }
  }

  // Clear all placeMarkers
  function clearPlaceMarkers() {
    setMapOnAll(null);
    placeIds = {};
    placeMarkers = [];
  }

  function setMapOnAll(map) {
    for (var i = 0; i < placeMarkers.length; i++) {
      placeMarkers[i].setMap(map);
    }
  }

  function modifyIcon(icon, changes) {
    return Object.assign({}, icon, changes);
  }

  // Get correct day index for 'place.opening_hours.weekday_text[index]'
  // Monday: 0, Sunday: 6, etc.
  function getAdjustedDayIndex() {
    var adjustedDayIndex;
    const OFFSET = 1,
          MIDNIGHT_OFFSET = 1;
    // Check if the current time is past midnight
    if (hour <= 5) {
      adjustedDayIndex = today - OFFSET - MIDNIGHT_OFFSET;
    } else {
      adjustedDayIndex = today - OFFSET;
    }
    // Adjust negative index
    if (adjustedDayIndex < 0) {
      adjustedDayIndex += 7;
    }
    return adjustedDayIndex;
  }

  revealingModule = { initMap: initMap };

})(window, document);
