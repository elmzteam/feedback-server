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
	})
});