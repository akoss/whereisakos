"use strict";
exports.__esModule = true;
var express = require("express");
var needle = require("needle");
var moment = require("moment");
var ical = require("ical");
var bodyParser = require("body-parser");
var app = express();
var cors = require("cors");
var mfp = require("mfp"); // MyFitnessPal
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
// Metadata
var nomadlistUser = "akos";
var nomadlistKey = process.env.NOMADLIST_KEY;
var foursquareToken = process.env.FOURSQUARE_TOKEN;
var lifesheetURL = "https://fx-life-sheet.herokuapp.com/";
var googleMapsKey = "AIzaSyDeiw5iiluUP6Txt7H584no1adlsDj-jUc";
var githubUser = "akoss";
var githubFullName = "Akos Szente";
var myFitnessPalUser = "akosur";
// Cache
var finishedLoadingNomadList = false;
var finishedLoadingSwarm = false;
var currentCityText = null;
var currentLat = null;
var currentLng = null;
var nextCityText = null;
var nextCityDate = null;
var nextStays = [];
var currentMoodLevel = null;
var currentMoodEmoji = null;
var otherFxLifeData;
var currentMoodRelativeTime = null;
var nextEvents = [];
var nextConferences = [];
var recentPhotos = null;
var isMoving;
var lastCommitMessage;
var lastCommitRepo;
var lastCommitLink;
var lastCommitTimestamp;
var todaysMacros;
var todaysFoodItems = [];
var numberOfPersonalTodoItems;
var numberOfWorkTodoItems;
var latestSwarmCheckin = null;
var githubContributionsChart = null;
var lastWorkout = null;
var lastActivities = [];
var lastActivityUpdate = null;
function timestampToWhen(timestamp) {
    var currentDate = Math.floor(new Date().getTime() / 1000);
    if (currentDate - timestamp < 60 * 60 * 2) {
        return "recently";
    }
    if (currentDate - timestamp < 60 * 60 * 6) {
        return "a few hours ago";
    }
    if (currentDate - timestamp < 60 * 60 * 12) {
        return "today";
    }
    if (currentDate - timestamp < 60 * 60 * 24 * 2) {
        return "yesterday";
    }
    if (currentDate - timestamp < 60 * 60 * 24 * 3) {
        return "this week";
    }
    return "long ago";
}
// Refresher methods
function updateSwarmCheckin() {
    var foursquareUrl = "https://api.foursquare.com/v2/users/self/checkins?oauth_token=" +
        foursquareToken +
        "&limit=1&sort=newestfirst&v=20210911";
    needle.get(foursquareUrl, function (error, response, body) {
        var _a, _b, _c, _d, _e, _f;
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedFoursquareData = body;
            var latestCheckin = (_c = (_b = (_a = parsedFoursquareData === null || parsedFoursquareData === void 0 ? void 0 : parsedFoursquareData["response"]) === null || _a === void 0 ? void 0 : _a["checkins"]) === null || _b === void 0 ? void 0 : _b["items"]) === null || _c === void 0 ? void 0 : _c[0];
            if (latestCheckin) {
                latestSwarmCheckin = {
                    name: (_d = latestCheckin === null || latestCheckin === void 0 ? void 0 : latestCheckin["venue"]) === null || _d === void 0 ? void 0 : _d["name"],
                    formattedAddress: (_f = (_e = latestCheckin === null || latestCheckin === void 0 ? void 0 : latestCheckin["venue"]) === null || _e === void 0 ? void 0 : _e["location"]) === null || _f === void 0 ? void 0 : _f["formattedAddress"].join(", "),
                    when: latestCheckin["createdAt"]
                        ? timestampToWhen(latestCheckin["createdAt"])
                        : ""
                };
            }
            finishedLoadingSwarm = true;
            console.log("Successfully loaded Foursquare/Swarm data: " +
                latestSwarmCheckin["name"] +
                ", " +
                latestSwarmCheckin["formattedAddress"]);
        }
    });
}
function updateNomadListData() {
    nextStays = [];
    var nomadlistUrl = "https://nomadlist.com/@" +
        nomadlistUser +
        ".json" +
        (nomadlistKey ? "?key=" + nomadlistKey : "");
    needle.get(nomadlistUrl, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            var parsedNomadListData = body;
            var now = parsedNomadListData["location"]["now"];
            var next = parsedNomadListData["location"]["next"];
            if (now["date_start"] == moment().format("YYYY-MM-DD")) {
                // Today I'm switching cities, let's show a "moving" status on the website
                var previous = parsedNomadListData["location"]["previously"];
                currentCityText = "✈️ " + now["city"];
                isMoving = true;
            }
            else if (now["country_code"]) {
                currentCityText =
                    now["city"] + ", " + now["country_code"].toUpperCase();
                isMoving = false;
            }
            else {
                isMoving = false;
                currentCityText = "Unknown";
            }
            currentLat = now["latitude"];
            currentLng = now["longitude"];
            if (next) {
                nextCityText = next["city"];
            }
            if (nextCityText != null) {
                nextCityDate = moment(next["date_start"]).fromNow();
            }
            for (var index in parsedNomadListData["trips"]) {
                var currentStay = parsedNomadListData["trips"][index];
                if (currentStay["epoch_start"] > new Date().getTime() / 1000) {
                    nextStays.unshift({
                        name: currentStay["place"] + ", " + currentStay["country"],
                        from: moment(currentStay["epoch_start"] * 1000).fromNow(),
                        fromDate: moment(currentStay["epoch_start"] * 1000),
                        "for": currentStay["length"],
                        toDate: moment(currentStay["epoch_end"] * 1000)
                    });
                }
            }
            finishedLoadingNomadList = true;
            console.log("Successfully loaded nomadlist data");
        }
    });
}
function updateMood() {
    needle.get(lifesheetURL, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        else if (response.statusCode == 200) {
            otherFxLifeData = body;
            var mood = parseInt(body["mood"]["value"]);
            switch (mood) {
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
                    currentMoodLevel = "okay";
                    currentMoodEmoji = "🙃";
                    break;
                case 1:
                    currentMoodLevel = "okay";
                    currentMoodEmoji = "🙃";
                    break;
                case 0:
                    currentMoodLevel = "okay";
                    currentMoodEmoji = "🙃";
                    break;
            }
            currentMoodRelativeTime = moment(new Date(body["mood"]["time"])).fromNow();
        }
    });
}
function updateCommitMessage() {
    var githubURL = "https://api.github.com/users/" + githubUser + "/events";
    needle.get(githubURL, function (error, response, body) {
        if (response.statusCode == 200) {
            for (var index in body) {
                var currentEvent = body[index];
                if (currentEvent["type"] == "PushEvent") {
                    var commits = currentEvent["payload"]["commits"].reverse();
                    for (var commitIndex in commits) {
                        var currentCommit = commits[commitIndex];
                        if (!currentCommit["message"].includes("Merge") &&
                            currentCommit["author"]["name"] == githubFullName) {
                            lastCommitMessage = currentCommit["message"];
                            lastCommitRepo = currentEvent["repo"]["name"];
                            // Convert the GitHub API link to a `html_url`
                            lastCommitLink = currentCommit["url"]
                                .replace("api.github.com", "github.com")
                                .replace("github.com/repos", "github.com")
                                .replace("/commits/", "/commit/");
                            lastCommitTimestamp = new Date(currentEvent["created_at"]);
                            return;
                        }
                    }
                }
            }
        }
        else {
            console.log(error);
        }
    });
}
function fetchTrelloItemsFromOneBoard(board_id, isWork) {
    var trelloUrl = "https://api.trello.com/1/boards/" +
        board_id +
        "/lists?cards=open&card_fields=all&filter=open&fields=all&key=" +
        process.env.TRELLO_API_KEY +
        "&token=" +
        process.env.TRELLO_API_TOKEN;
    needle.get(trelloUrl, function (error, response, body) {
        var numberOfTodoItems = 0;
        if (error) {
            console.error(error);
            return;
        }
        if (response.statusCode == 200) {
            for (var i in body) {
                var currentList = body[i];
                if (!currentList["name"].startsWith("Done")) {
                    numberOfTodoItems += currentList["cards"].length;
                }
            }
        }
        else {
            console.error("error fetching Trello tasks: " + response.statusCode);
        }
        if (isWork) {
            numberOfWorkTodoItems = numberOfTodoItems;
        }
        else {
            numberOfPersonalTodoItems = numberOfTodoItems;
        }
    });
}
function fetchTrelloItems() {
    // via https://developers.trello.com/reference#boardsboardidlabels
    fetchTrelloItemsFromOneBoard(process.env.TRELLO_WORK_BOARD_ID, true);
    fetchTrelloItemsFromOneBoard(process.env.TRELLO_PERSONAL_BOARD_ID, false);
}
function fetchMostRecentPhotos() {
    var instagramUrl = "https://api.instagram.com/v1/users/self/media/recent?access_token=" +
        process.env.INSTAGRAM_ACCESS_TOKEN;
    needle.get(instagramUrl, function (error, response, body) {
        if (response.statusCode == 200) {
            recentPhotos = [];
            var mostRecentData = body["data"];
            for (var i in mostRecentData) {
                var currentPhoto = mostRecentData[i];
                var caption = null;
                if (currentPhoto["caption"] && currentPhoto["caption"]["text"]) {
                    caption = currentPhoto["caption"]["text"];
                }
                recentPhotos.push({
                    text: caption,
                    url: currentPhoto["images"]["standard_resolution"]["url"],
                    link: currentPhoto["link"],
                    posted: new Date(parseInt(currentPhoto["created_time"]) * 1000)
                });
            }
        }
        else {
            console.log(error);
            console.log(response);
        }
    });
}
function processFoodData(data) {
    todaysMacros = {
        kcal: data["calories"],
        carbs: data["carbs"],
        protein: data["protein"],
        fat: data["fat"]
    };
    todaysFoodItems = [];
    for (var rawFoodItemIndex in data["entries"]) {
        var rawFoodItem = data["entries"][rawFoodItemIndex];
        if (![
            "TOTAL:",
            "Exercises",
            "Withings Health Mate  calorie adjustment"
        ].includes(rawFoodItem["name"])) {
            todaysFoodItems.push({
                name: rawFoodItem["name"],
                amount: rawFoodItem["amount"]
            });
        }
    }
}
function updateGithubContributionsChart() {
    var githubURL = "https://github.com/users/" + githubUser + "/contributions";
    needle.get(githubURL, function (error, response, body) {
        if (response.statusCode == 200) {
            var viewboxedBody = body.replace('width="828" height="128"', 'viewBox="0 0 828 128"');
            var start = viewboxedBody.indexOf("<svg");
            var end = viewboxedBody.indexOf("</svg>");
            githubContributionsChart = viewboxedBody.slice(start, end + 6);
            console.log("Loaded GitHub chart (length: " + githubContributionsChart.length + ")");
        }
        else {
            console.log(error);
        }
    });
}
function updateFoodData() {
    mfp.fetchSingleDate(myFitnessPalUser, moment().format("YYYY-MM-DD"), ["calories", "protein", "carbs", "fat", "entries"], function (data) {
        if (data["calories"] == undefined || data["calories"] == 0) {
            mfp.fetchSingleDate(myFitnessPalUser, moment()
                .subtract(1, "day")
                .format("YYYY-MM-DD"), ["calories", "protein", "carbs", "fat", "entries"], function (data) {
                processFoodData(data);
            });
        }
        else {
            processFoodData(data);
        }
    });
}
function updateCalendar() {
    nextEvents = [];
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
                            rawStart: moment(ev["start"]),
                            start: moment(ev["start"]).fromNow(),
                            end: moment(ev["end"]).fromNow(),
                            duration: Math.round(moment(ev["end"]).diff(ev["start"], "hours", true) * 10.0) / 10.0
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
    // TODO: potentially fetch them from https://github.com/KrauseFx/speaking
    nextConferences = [
    // {
    //   location: "Belgrade, Serbia",
    //   dates: "19th Oct",
    //   name: "heapcon",
    //   link: "https://heapcon.io/"
    // }
    ];
}
function generateMapsUrl() {
    return ("https://maps.googleapis.com/maps/api/staticmap?center=" +
        currentCityText +
        "&zoom=10&size=1200x190&scale=2&maptype=roadmap" +
        "&key=" +
        googleMapsKey);
}
function allDataLoaded() {
    if (!finishedLoadingNomadList || !finishedLoadingSwarm) {
        return false;
    }
    if (lastCommitMessage == null) {
        return false;
    }
    return true;
}
// The first number is the # of minutes to wait to reload
setInterval(updateNomadListData, 60 * 60 * 1000);
setInterval(updateSwarmCheckin, 5 * 60 * 1000);
//setInterval(updateMood, 30 * 60 * 1000);
//setInterval(fetchMostRecentPhotos, 30 * 60 * 1000);
// setInterval(updateCalendar, 15 * 60 * 1000);
setInterval(updateCommitMessage, 5 * 60 * 1000);
setInterval(updateGithubContributionsChart, 15 * 60 * 1000);
setInterval(updateFoodData, 15 * 60 * 1000);
setInterval(fetchTrelloItems, 15 * 60 * 1000);
fetchTrelloItems();
//fetchMostRecentPhotos();
updateNomadListData();
updateSwarmCheckin();
//updateMood();
// updateCalendar();
updateConferences();
updateCommitMessage();
updateGithubContributionsChart();
updateFoodData();
function getDataDic() {
    return {
        currentCityText: currentCityText,
        nextCityText: nextCityText,
        nextCityDate: nextCityDate,
        currentMoodLevel: currentMoodLevel,
        otherFxLifeData: otherFxLifeData,
        currentMoodEmoji: currentMoodEmoji,
        currentMoodRelativeTime: currentMoodRelativeTime,
        nextConferences: nextConferences,
        nextEvents: nextEvents,
        nextStays: nextStays,
        isMoving: isMoving,
        numberOfPersonalTodoItems: numberOfPersonalTodoItems,
        numberOfWorkTodoItems: numberOfWorkTodoItems,
        latestSwarmCheckin: latestSwarmCheckin,
        lastCommitMessage: lastCommitMessage,
        lastCommitRepo: lastCommitRepo,
        lastCommitLink: lastCommitLink,
        lastCommitTimestamp: lastCommitTimestamp,
        githubContributionsChart: githubContributionsChart,
        todaysMacros: todaysMacros,
        todaysFoodItems: todaysFoodItems,
        lastWorkout: lastWorkout,
        lastActivities: lastActivities,
        lastActivityUpdate: lastActivityUpdate,
        mapsUrl: generateMapsUrl(),
        localTime: moment()
            .subtract(-1, "hours") // -1 = VIE, 5 = NYC, 8 = SF
            .format("hh:mm a"),
        profilePictureUrl: "https://akos.dev/profile.jpg",
        recentPhotos: recentPhotos
    };
}
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
app.post("/activity", function (req, res) {
    // - Get the "Health Auto Export" app (https://apps.apple.com/hu/app/health-auto-export-json-csv/id1115567069)
    // - Set up a scheduled API export to `/activity` with the last 7 days' data
    //   (active energy, Apple exercise time, Apple stand hours) in JSON format and include workouts.
    //
    // TODO: persistency
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var metrics = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a["data"]) === null || _b === void 0 ? void 0 : _b["metrics"];
    if (!metrics)
        res.sendStatus(400);
    var activityPerDay = [];
    var activeEnergy = metrics.filter(function (metric) { return metric["name"] === "active_energy"; });
    var exerciseTime = metrics.filter(function (metric) { return metric["name"] === "apple_exercise_time"; });
    var standHour = metrics.filter(function (metric) { return metric["name"] === "apple_stand_hour"; });
    if (activeEnergy[0]["data"].length !== exerciseTime[0]["data"].length ||
        exerciseTime[0]["data"].length !== standHour[0]["data"].length)
        res.sendStatus(400);
    for (var index = 0; index < activeEnergy[0]["data"].length; ++index) {
        var day = {
            activeEnergy: Math.round(activeEnergy[0]["data"][index]["qty"]),
            exerciseTime: Math.round(exerciseTime[0]["data"][index]["qty"]),
            standHour: standHour[0]["data"][index]["qty"]
        };
        activityPerDay.push(day);
    }
    var workouts = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c["data"]) === null || _d === void 0 ? void 0 : _d["workouts"];
    lastWorkout = workouts[0]
        ? {
            timestamp: new Date((_e = workouts[0]) === null || _e === void 0 ? void 0 : _e.end),
            activeEnergy: Math.round((_g = (_f = workouts[0]) === null || _f === void 0 ? void 0 : _f.activeEnergy) === null || _g === void 0 ? void 0 : _g.qty),
            name: (_h = workouts[0]) === null || _h === void 0 ? void 0 : _h.name
        }
        : null;
    lastActivities = activityPerDay;
    lastActivityUpdate = new Date();
    res.sendStatus(200);
});
var port = process.env.PORT || 8080;
app.listen(port);
console.log("server live on port " + port);
