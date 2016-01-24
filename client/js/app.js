$(document).ready(function(){
	$("nav #logout").click(function(e){
		Cookies.remove("user");
		Cookies.remove("session");
	});
});

var map;
var loc;
var markers = [];

function initMap() {
	map = new google.maps.Map(document.getElementsByTagName("feedback-map")[0], {
		center: {
			lat: 39.9520705,
			lng: -75.1928003
		},
		zoom: 16
	});

	if(navigator.geolocation){
		navigator.geolocation.getCurrentPosition(function(pos){
			loc = pos;
			if(map){
				map.setCenter(pos);
			}

			fetch("/restaurants?lat=" + pos.coords.latitude + "&lon=" + pos.coords.longitude, {
				method: "GET",
				credentials: "same-origin"
			})
				.then(checkStatus)
				.then(function(data){
				return data.json();
			})
				.then(function(data){
				for(var i = 0; i < data.length; i++){
					console.log(data[i]);
					markers.push(new google.maps.Marker({
						position: {
							lat: data[i].location.coordinates[0],
							lng: data[i].location.coordinates[1]
						},
						label: data[i].name,
						map: map,
						animation: google.maps.Animation.DROP
					}));
				}
			})
				.catch(function(err){
				console.error(err);
			});
		});
	}
}

var checkStatus = function(response){
	if(response.status >= 200 && response.status < 300){
		return response;
	} else {
		var error = new Error(response.statusText);
		error.response = response;
		throw error;
	}
}