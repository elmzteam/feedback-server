$(document).ready(function(){
	$(window).scroll(function(){
		if($(this).scrollTop() > 120){
			$("header").addClass("full");
		} else {
			$("header").removeClass("full");
		}
	});

	$("#find-out-how").click(function(){
		$("html, body").animate({
			scrollTop: $("feedback-slide#how").offset().top + "px"
		});
		$("header").addClass("full");
	});

	$("nav #login").click(function(e){
		$("feedback-dialog").removeClass("active");
		$("feedback-dialog#login").addClass("active");
		e.stopPropagation();
	})

	$("nav #register, #sign-me-up").click(function(e){
		$("feedback-dialog").removeClass("active");
		$("feedback-dialog#register").addClass("active");
		e.stopPropagation();
	})

	$("feedback-dialog").click(function(e){
		e.stopPropagation();
	});

	$("html").click(function(){
		$("feedback-dialog").removeClass("active");
	});

	$("#login-form").submit(function(e){
		fetch("/login", {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				user: $(e.target).find(".username").val(),
				password: $(e.target).find(".password").val()
			})
		})
			.then(checkStatus)
			.then(function(data){
			return data.json();
		})
			.then(function(data){
			console.log(data);
			Cookies.set("user", $(e.target).find(".username").val());
			Cookies.set("session", data.session);
			window.location = "/app.html";
		})
			.catch(function(err){
			console.error("If only we had a good user alert system.");
		});

		e.stopPropagation();
		e.preventDefault();
		return false;
	});

	$("#register-form").submit(function(e){
		fetch("/register", {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				email: $(e.target).find(".email").val(),
				user: $(e.target).find(".username").val(),
				password: $(e.target).find(".password").val()
			})
		})
			.then(checkStatus)
			.then(function(data){
			return data.json();
		})
			.then(function(data){
			console.log(data);
			Cookies.set("user", $(e.target).find(".username").val());
			Cookies.set("session", data.session);
			window.location = "/app.html";
		})
			.catch(function(err){
			console.error("If only we had a good user alert system.");
		});

		e.stopPropagation();
		e.preventDefault();
		return false;
	});
});

var checkStatus = function(response){
	if(response.status >= 200 && response.status < 300){
		return response;
	} else {
		var error = new Error(response.statusText);
		error.response = response;
		throw error;
	}
}