Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

  var state = {};

  rs.on_load(function() {
		
		var results = rs.subject[rs.user_id].data["results"];
  	
		for (var i = 0; i < results.length; i++) {
				var row = '<tr><td>' + (i + 1) + '</td><td>' + results[i].x.toFixed(2) + '</td><td>' + results[i].y.toFixed(2) + '</td><td>$' + results[i].utility.toFixed(2) + '</td></tr>';
				$("#results").append(row);
		}
		
		var row = '<tr class="success" style="font-weight:bold;"><td>Total</td><td></td><td></td><td>$' + rs.accumulated_points.toFixed(2) + '</td></tr>';
		$("#results").append(row);
	});
	
}]);
