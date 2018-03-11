"use strict";
exports.__esModule = true;
var express = require("express");
var needle = require("needle");
var moment = require("moment");
var ical = require("ical");
var app = express();
app.set("view engine", "ejs");
// Metadata
var nomadlistUser = "krausefx";
var moodHostUrl = "https://krausefx-mood.herokuapp.com/";
// Cache
var currentCityText = "";
var currentLat = null;
var currentLng = null;
var nextCityText = null;
var nextCityDate = null;
var currentMoodLevel = null;
var currentMoodEmoji = null;
var currentModeRelativeTime = null;
var nextEvents = [];
var nextConferences = [];
// Refresher methods
function updateNomadListData() {
    var nomadlistUrl = "https://nomadlist.com/@" + nomadlistUser + ".json";
    needle.get(nomadlistUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedNomadListData = JSON.parse(body);
            var now = parsedNomadListData["location"]["now"];
            var next = parsedNomadListData["location"]["next"];
            currentCityText = now["city"] + ", " + now["country"];
            currentLat = now["latitude"];
            currentLng = now["longitude"];
            nextCityText = next["city"] + ", " + next["country"];
            nextCityDate = next["date_start"];
            console.log("Successfully loaded nomadlist data");
        }
    });
}
function updateMood() {
    var moodUrl = moodHostUrl + "current_mood.json";
    needle.get(moodUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedBody = JSON.parse(body);
            switch (parseInt(parsedBody["value"])) {
                case 5:
                    currentMoodLevel = "pumped, energized";
                    currentMoodEmoji = "🤩";
                    break;
                case 4:
                    currentMoodLevel = "happy, excited";
                    currentMoodEmoji = "😃";
                    break;
                case 3:
                    currentMoodLevel = "good, alright";
                    currentMoodEmoji = "😎";
                    break;
                case 2:
                    currentMoodLevel = "down, worried";
                    currentMoodEmoji = "😐";
                    break;
                case 1:
                    currentMoodLevel = "Sad, unhappy";
                    currentMoodEmoji = "😔";
                    break;
                case 0:
                    currentMoodLevel = "Miserable, nervous";
                    currentMoodEmoji = "😩";
                    break;
            }
            currentModeRelativeTime = moment(new Date(parsedBody["time"])).fromNow();
        }
    });
}
function updateCalendar() {
    var icsUrls = [process.env.ICS_URL, process.env.WORK_ICS_URL];
    for (var index in icsUrls) {
        ical.fromURL(icsUrls[index], {}, function (err, data) {
            console.log("Loaded calendar data");
            for (var k in data) {
                if (data.hasOwnProperty(k)) {
                    var ev = data[k];
                    // only use calendar invites that within the next 7 days
                    if (ev["type"] == "VEVENT" &&
                        moment(ev["start"]).isBetween(new Date(), moment(new Date()).add(5, "days")) &&
                        moment(ev["end"]).diff(ev["start"], "hours") < 24 // we don't want day/week long events
                    ) {
                        nextEvents.push({
                            rawStart: ev["start"],
                            start: moment(ev["start"]).fromNow(),
                            end: moment(ev["end"]).fromNow(),
                            duration: moment(ev["end"]).diff(ev["start"], "hours", true)
                        });
                    }
                }
            }
            nextEvents.sort(function (a, b) {
                return a["rawStart"] - b["rawStart"];
            });
        });
    }
}
function updateConferences() {
    // TODO: fetch them from https://github.com/KrauseFx/speaking
    nextConferences = [
        {
            location: "Saint Petersburg, Russia",
            dates: "20th, 21st April 2018",
            name: "MobiusConf",
            link: "https://mobiusconf.com/en/"
        },
        {
            location: "Vienna, Austria",
            dates: "16th - 18th May",
            name: "WeAreDevelopers",
            link: "https://www.wearedevelopers.com/congress/"
        }
    ];
}
function allDataLoaded() {
    if (currentCityText == null || nextCityText == null || nextCityDate == null) {
        return false;
    }
    if (nextEvents.length == 0) {
        return false;
    }
    return true;
}
setInterval(updateNomadListData, 60 * 60 * 1000);
setInterval(updateMood, 30 * 60 * 1000);
setInterval(updateCalendar, 15 * 60 * 1000);
updateNomadListData();
updateMood();
updateCalendar();
updateConferences();
function getDataDic() {
    return {
        currentCityText: currentCityText,
        nextCityText: nextCityText,
        nextCityDate: nextCityDate,
        currentMoodLevel: currentMoodLevel,
        currentMoodEmoji: currentMoodEmoji,
        currentModeRelativeTime: currentModeRelativeTime,
        nextConferences: nextConferences,
        nextEvents: nextEvents
    };
}
// Web server
app.get("/", function (req, res) {
    // Because we're using the free Heroku tier for now
    // this means the server might just have started up
    // if that's the case, we'll have to wait until all data
    // is fetched
    if (allDataLoaded()) {
        res.render("pages/index", getDataDic());
    }
    else {
        res.render("pages/loading");
    }
});
app.get("/api.json", function (req, res) {
    if (allDataLoaded()) {
        res.json(getDataDic());
    }
    else {
        res.json({
            loading: true
        });
    }
});
var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);