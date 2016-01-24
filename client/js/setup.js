$(document).ready(function(){
	fetch("/setup",{
		method: "GET",
		credentials: "same-origin"
	})
		.then(checkStatus)
		.then(function(data){
		return data.json();
	})
		.then(function(data){
		var cont = $("#item-setup-list");

		for(var i = 0; i < data.length; i++){
			var item = $("<div class='item' data-id='" + data[i]._id + "'></div>");
			item.append("<span class='name'>" + data[i].name + "</span>");
			var buttons = item.append("<div class='buttons'></div>").find(".buttons");
			buttons.append("<span class='material-icons down'>thumb_down</span>");
			buttons.append("<span class='material-icons neut'>mood</span>");
			buttons.append("<span class='material-icons up'>thumb_up</span>");

			cont.append(item);
		}

		cont.append("<input id='submit' type='submit'>");
	})
		.catch(function(err){
		console.error("Well darn.");
		console.error(err);
	});

	$("#item-setup-list").on("click", ".item .buttons .material-icons", function(){
		$(this).parent().children().removeClass("selected");
		$(this).addClass("selected");
	});

	$("#submit").click(function(){
		var promises = [];

		$("#item-setup-list .item").each(function(i, el){
			var sel = $(el).find(".selected");

			if(sel){
				var val = .5;
				
				if(sel.hasClass("up")){
					val = 1;
				}
				
				if(sel.hasClass("down")){
					val = 0;
				}
				
				promises.push(fetch("/rating", {
					method: "PUT",
					headers: {
						"Accept": "application/json",
						"Content-Type": "application/json"
					},
					credentials: "same-origin",
					body: JSON.stringify({
						item: $(el).attr("data-id"),
						rating: val
					})
				}));
			}
		});
		
		Promise.all(promises).then(function(){
			window.location.href = "/app.html";
		});

		return false;
	})
})

var checkStatus = function(response){
	if(response.status >= 200 && response.status < 300){
		return response;
	} else {
		var error = new Error(response.statusText);
		error.response = response;
		throw error;
	}
}