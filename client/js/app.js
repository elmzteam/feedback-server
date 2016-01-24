$(document).ready(function(){
	$("nav #logout").click(function(e){
		Cookies.remove("user");
		Cookies.remove("session");
	});
});

var map;
var loc;

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
			console.log(pos);
			var marker = new google.maps.Marker({
				position: {lat: pos.coords.latitude, lng: pos.coords.longitude},
				map: map,
				title: "Current Location"
			});
		});
	}
}