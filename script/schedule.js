var $ = require("jquery");
var DateUtil = require("./dateUtil.js");
var Options = require("./options.js");
var Parser = require("./scheduleParser.js");
var Period = require("./period.js");

var opts = Options.options;


var DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


var displayDate; //beginning of time period currently being displayed by the schedule
var isCurrent = true;

var hasFocus = true; //document.hasFocus() seems to be unreliable; assumes window has focus on page load

var updateScheduleIntervalID;

exports.init = function() {
	document.addEventListener("visibilitychange", function(event) {
		if(!document.hidden) { //only slightly redundant; on un-minimize, document gains visibility without focus
			update();
			// updateClock();
		}
		updateUpdateInterval();
	});

	addEventListener("focus", function(event) {
		update();
		//updateClock();
		
		hasFocus = true;
		updateUpdateInterval();
	});
	addEventListener("blur", function(event) {
		hasFocus = false;
		updateUpdateInterval();
	});
	
	
	Parser.init();
};

exports.getDisplayDate = function() {
	return new Date(displayDate);
};

//exports.setHiddenUpdateInterval = function(interval) {
//	opts.hiddenUpdateInterval = interval;
//};
//exports.setActiveUpdateInterval = function(interval) {
//	opts.activeUpdateInterval = interval;
//};
//exports.setInactiveUpdateInterval = function(interval) {
//	opts.inactiveUpdateInterval = interval;
//};

/**
 * Sets the correct update interval based on the current state (focus and visibility) of the document.
 */
function updateUpdateInterval() {
	if(document.hidden) setUpdateInterval(opts.hiddenUpdateInterval); //assume that hidden implies no focus
	else if(hasFocus) setUpdateInterval(opts.activeUpdateInterval);
	else setUpdateInterval(opts.inactiveUpdateInterval);
}
exports.updateUpdateInterval = updateUpdateInterval;

/**
 * Updates the interval for automatically refreshing the page.
 * seconds is the new interval in seconds.
 */
function setUpdateInterval(seconds) {
	clearInterval(updateScheduleIntervalID);
	if(seconds>0)
		updateScheduleIntervalID = setInterval(function() {
			//updateClock();
			update();
		}, seconds * 1000); //convert to milliseconds
	else updateScheduleIntervalID = null;
}

exports.setDate = function(date) {
	isCurrent = onSameDisplayUnit(date, new Date());
	update(date);
};

exports.update = update;
function update(date) {
	var newDate;
	if(isCurrent)
		newDate = new Date();
	else if(date)
		newDate = date;
	else
		newDate = displayDate;
	
	if(!onSameDisplayUnit(newDate, displayDate)) {
		updateSchedule(newDate);
	}
	
	updateHighlightedPeriod();
}

exports.forceUpdate = forceUpdate;
function forceUpdate(date) {
	var newDate;
	if(isCurrent)
		newDate = new Date();
	else if(date)
		newDate = date;
	else
		newDate = displayDate;
	
	updateSchedule(newDate);
	
	updateHighlightedPeriod();
}

function onSameDisplayUnit(date1, date2) {
	return opts.enableDayView ?
		DateUtil.getDayBeginning(date1) == DateUtil.getDayBegninning(date2) :
		DateUtil.getMonday(date1) == DateUtil.getMonday(date2)
}

/**
 * Displays schedule of the week of the given date/time
 */
function updateSchedule(date) {
	date = DateUtil.getDayBeginning(date);
	displayDate = new Date(date);
	
	var schedule = document.getElementById("schedule"); //get schedule table
	
	if(DateUtil.getMonday(date) > DateUtil.getMonday(new Date()))
		warn("This is a future date, so the schedule may be incorrect. (In particular, special/alternate schedules may be missing.)"); //display warning if date is in the future
	else warn(""); //else display message
	
	/*
	if(date.valueOf()==dateUtil.getMonday(new Date()).valueOf()) document.getElementById("currWeek").style.display = "none"; //hide back to current week button on current week
	else document.getElementById("currWeek").style.display = "inline"; //else show the button
	*/
	while(schedule.rows.length) schedule.deleteRow(-1); //clear existing weeks (rows); there should only be one, but just in case...
	
	var week = schedule.insertRow(-1); //create new week (row)
	
	if(!opts.enableDayView) {
		date = DateUtil.getMonday(date);
		for(var d=0;d<5;d++) {
			//for each day Monday through Friday (inclusive)
			createDay(week, date);
			
			date.setDate(date.getDate()+1); //increment day
		}
	} else createDay(week, date);
}


/**
 * Displays the given warning or hides the warning div if no warning text is given.
 */
function warn(text) {
	var warning = document.getElementById("warning");
	
	if(text) warning.style.display = "block";
	else warning.style.display = "none";
	
	warning.innerHTML = text;
}

/**
 * Creates the day for the given date and appends it to the given week
 */
function createDay(week, date) {
	var daySchedule = Parser.getDayInfo(date); //get schedule for that day
	
	var dateString = date.getMonth().valueOf()+1 + "/" + date.getDate().valueOf() + "/" + date.getFullYear().toString().substr(-2);
	
	var col = week.insertCell(-1); //create cell for day
	col.date = date.valueOf(); //store date in cell element
	
	if(date.getMonth()==9 && date.getDate()==31) //check Halloween
		col.classList.add("halloween");
	
	var head = document.createElement("div"); //create header div in cell
	head.classList.add("head");
	var headWrapper = document.createElement("div");
	headWrapper.classList.add("headWrapper");
	headWrapper.innerHTML = DAYS_OF_WEEK[date.getDay()] + "<div class=\"headDate\">" + dateString + /*" (" + daySchedule.id + ")*/"</div>"; //Portion commented out represents schedule id of that day
	head.appendChild(headWrapper);
	col.appendChild(head);
	
	var prevEnd = "8:00"; //set start of day to 8:00AM
	

	for(var i=0;i<daySchedule.length;i++) {
		var periodObj = daySchedule[i];
		var passing = $("<div>").addClass("period");

		var period = document.createElement("div");
		period.classList.add("period");
		
		if(opts.showPassingPeriods) {
			passing.append(Period.createPeriod("",prevEnd,periodObj.start,date));
			col.appendChild(passing.get(0));
			prevEnd = periodObj.end;
		}
		
		period.appendChild(periodObj.getHTML(date));
			
		col.appendChild(period);
	}
}

/**
 * Highlights given date/time on the schedule; defaults to now if none is given
 */
function updateHighlightedPeriod(time) {
	//set default time argument
	if(!time) time = Date.now();

	//set date based on time (for finding day to highlight)
	var date = new Date(time);
	date.setHours(0,0,0,0);

	//clear previous highlighted day/periods
	//TODO: maybe it would be better to not clear highlights when nothing needs to be changed.
	var prevDay = document.getElementById("today");
	var prevPeriods = [];
	if(prevDay) {
		//clear previous highlighted periods
		prevPeriods = Array.prototype.slice.call(prevDay.getElementsByClassName("now")); //get copy of array, not reference to it (needed to check for period changes later)

		for(var i=prevPeriods.length-1;i>=0;i--) {
			var prevPeriod = prevPeriods[i];
			prevPeriod.classList.remove("now");
			//remove period length
			var periodLength = prevPeriod.getElementsByClassName("periodLength")[0];
			if(periodLength) prevPeriod.removeChild(periodLength);
		}
		
		//clear previous highlighted day
		//needs to be done after getting prevPeriods, or else prevDay no longer points anywhere
		prevDay.id = "";
	}

	//set new highlighted day/period
	var days = document.getElementById("schedule").rows[0].cells;
	for(var d=0;d<days.length;d++) {
		var day = days[d];
		if(date.valueOf() == day.date) { //test if date should be highlighted
			//set new highlighted day
			day.id = "today";

			//set new highlighted periods
			var periods = day.getElementsByClassName("periodWrapper");
			for(var p=0;p<periods.length;p++) {
				var period = periods[p];
				if(time-period.start>=0 && time-period.end<0) { //test if period should be highlighted
					period.classList.add("now");
					//add period length if it fits
					if((period.end-period.start)/60000>=40) {
						var length = (period.end - time) / 60000;
						period.innerHTML += "<div class=\"periodLength\">" +
								(length>1 ?
									Math.round(length) + " min. left</div>" :
									Math.round(length*60) + " sec. left</div>");
					}
				}
			}
		}
	}

	if(opts.enablePeriodNotifications) {
		var currPeriods = Array.prototype.slice.call(document.getElementsByClassName("now")); //needs to be an array and not an HTML

		var diff1 = getArrayDiff(currPeriods, prevPeriods);
		var diff2 = getArrayDiff(prevPeriods, currPeriods);

		for(var i=0; i<diff1.length; i++) {
			var name = currPeriods[i].periodName;
			if(name && !hasFocus) sendNotification(name + " has started.", opts.notificationDuration);
		}
		for(var i=0; i<diff2.length; i++) {
			var name = prevPeriods[i].periodName;
			if(name && !hasFocus) sendNotification(name + " has ended.", opts.notificationDuration);
		}
	}
}

/**
 * Returns an array of values in array1 that arent in array2
 */
function getArrayDiff(array1, array2) {
	return array1.filter(function(i) {return array2.indexOf(i) < 0;});
};

/**
 * Creates a desktop notification with the given text for a title and removes it after the given duration in seconds.
 * A duration of 0 or less will disable auto-closing the notification.
 */
function sendNotification(text, duration) {
	if("Notification" in window) { //check that browser supports notifications
		var notification = new Notification(text);
		if(duration > 0)
			setTimeout(function() {notification.close();}, duration*1000);
	}
}
