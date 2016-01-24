$(document).ready(function(){
	if(Cookies.get("user") === undefined || Cookies.get("session") === undefined){
		window.location.href = "/";
	}
	
	$("nav #logout").click(function(e){
		Cookies.remove("user");
		Cookies.remove("session");
		window.location.href = "/";
	});

	$("feedback-location-list").on("click", "feedback-location", function(){
		map.panTo({
			lat: parseFloat($(this).attr("data-lat")),
			lng: parseFloat($(this).attr("data-lon"))
		})
	})

	$("feedback-location-list").on("click", "feedback-location .show-menu", function(){
		var rest = null;
		var lat = parseFloat($(this).parent().attr("data-lat"));
		var lon = parseFloat($(this).parent().attr("data-lon"));

		for(var i = 0; i < restaurants.length; i++){
			if(restaurants[i].location.coordinates[1] == lat && restaurants[i].location.coordinates[0] == lon){
				rest = restaurants[i];
				break;
			}
		}

		if(rest == null){
			return;
		}


		$("feedback-lightbox").addClass("active");

		var locInfo = $("feedback-dialog").find(".location-info");
		locInfo.empty();

		if(rest.images.length > 0){
			var img = locInfo.append("<div class='preview-image'></div>").find(".preview-image");
			img.css("background-image", "url(" + rest.images[0] + ")");
		}

		locInfo.append("<h3>" + rest.name + "</h3>");
		locInfo.append("<div class='categories'>" + rest.categories + "</div>");
		locInfo.append("<div class='address'>" + rest.address + "</div>");

		var items = $("feedback-dialog").find(".items-listing");
		items.empty();

		fetch("/items/" + rest._id, {
			method: "GET",
			credentials: "same-origin"
		})
			.then(checkStatus)
			.then(function(data){
			return data.json();
		})
			.then(function(data){
			return data.sort(function(a, b){
				return b.preference - a.preference;
			});
		})
			.then(function(data){
			for(var i = 0; i < data.length; i++){
				var item = $("<div class='item'></div>");

				item.append("<div class='preference-bar' style='width: " + (data[i].preference * 50) + "ch'></div>");
				item.append("<span class='name'>" + data[i].name + "</span>");
				if(data[i].description.length > 0){
					item.append("<span class='description'>" + data[i].description.join(", ") + "</span>");
				}

				items.append(item);
			}
		})
	});

	$("feedback-lightbox").click(function(){
		$("feedback-lightbox").removeClass("active");
	});

	$("feedback-lightbox feedback-dialog").click(function(e){
		e.stopPropagation();
	})
});

var map;
var loc;
var markers = [];
var labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var restaurants;

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
				return data.sort(function(a, b){
					return b.
				})
			})
				.then(function(data){
				restaurants = data;
				for(var i = 0; i < data.length; i++){
					markers.push(new google.maps.Marker({
						position: {
							lat: data[i].location.coordinates[1],
							lng: data[i].location.coordinates[0]
						},
						label: labels.charAt(i),
						map: map,
						animation: google.maps.Animation.DROP
					}));

					var card = $("feedback-location-list").append("<feedback-location data-lat='" + data[i].location.coordinates[1] + "' data-lon='" + data[i].location.coordinates[0] + "'></feedback-location>").find("feedback-location:last-child");

					var img = card.append("<div class='label'>" + labels.charAt(i) + "</div>").find(".label");

					if(data[i].images.length > 0){
						img.css("background-image", "url(" + data[i].images[0] + ")");
					}

					card.append("<h3>" + data[i].name + "</h3>");
					card.append("<div class='categories'>" + data[i].categories + "</div>");
					card.append("<div class='address'>" + data[i].address + "</div>");
					card.append("<span class='material-icons show-menu'>restaurant_menu</span>");
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