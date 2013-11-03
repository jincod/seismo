var express = require('express');
var http = require('http');

var logger = require('./utils/logger');
var config = require('../config');
var moment = require('moment');
var db = require('./db');
var package = require('../package');

var app = express();

var cors = function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
	res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-Token, X-Revision, Content-Type');

	next();
};

app.configure(function(){
	app.set('port', process.env.PORT || 3005);
	app.use(express.bodyParser());
	app.use(cors);
	app.use(express.methodOverride());
	app.use(app.router);
});

// Healthcheck

app.get('/', function (req, res) {
	res.json({app: 'analytics', env: process.env.NODE_ENV, version: package.version, apiUrl: '/api'});
});

// Events

app.post('/api/events/:app', function (req, res) {
	var app = req.params.app;
	var payload = req.body;
	var event = payload.event;
	var data = payload.data;

	var parsed = parseEvent(event);
	if (!parsed) {
		logger.error({message: 'failed to parse event information'});
		return res.send(400, 'bad event format');
	}

	var record = {id: parsed.id, app: app, event: parsed.event, timestampt: moment().utc().toDate()};
	if (data) {
		record.data = data;
	}

	db.events.save(record, function (err, doc) {
		if (err) {
			logger.error({message: 'failed to store incoming event', err: err});
			return res.send(500, 'failed to store incoming event');
		}

		logger.info('recieved event from app: ' + app + ' event name: ' + parsed.event);

		res.json(201, doc);
	});
});

app.get('/api/events/:app', function (req, res) {
	var app = req.params.app;
	var query = {app: app};

	if (req.query.event) {
		query.event = req.query.event;
	}

	if (req.query.id) {
		query.id = req.query.id;
	}

	if (req.query.date) {
		query.timestampt = req.query.date === 'today' ? dateQuery() : dateQuery(req.query.date);
	}

	db.events.find(query).toArray(function (err, results) {
		if (err) {
			logger.error({message: 'failed to read events', err: err});
			return res.send(500, 'failed to read events');
		}

		logger.info('returned events for app: ' + app + ' event name: ' + query.event || query.id);

		res.json(results);
	});

	function dateQuery(date) {
		var from = date ? moment(date) : moment();

		from.set('hour', 0);
		from.set('minute', 0);
		from.set('second', 0);

		var to = moment(from);
		to.add('days', 1);

		return {
			$gte: from.utc().toDate(),
			$lt: to.utc().toDate()
		};
	}
});

// Reports

app.get('/api/reports/hour/:app', function (req, res) {
	var app = req.params.app;
	var query = {app: app};
	var date = req.query.date;
	var hour = req.query.hour;

	if (!date) {
		return res.send(403, 'missing date parameter');
	}

	if (!hour) {
		return res.send(403, 'missing hour parameter');
	}

	if (req.query.event) {
		query.event = req.query.event;
	}

	if (req.query.id) {
		query.id = req.query.id;
	}

	var from = date === 'today' ? moment.utc() : moment.utc(date);

	from.set('hour', hour);
	from.set('minute', 0);
	from.set('second', 0);

	var to = moment.utc(from);
	to.add('hours', 1);

	report(from, to, query, function (err, report) {
		if (err) {
			logger.error(err);
			res.send(500, err);
		}

		res.json(report);
	});
});

app.get('/api/reports/day/:app', function (req, res) {
	var app = req.params.app;
	var query = {app: app};
	var date = req.query.date;

	if (!date) {
		return res.send(403, 'missing hour parameter');
	}

	if (req.query.event) {
		query.event = req.query.event;
	}

	if (req.query.id) {
		query.id = req.query.id;
	}

	var from = date === 'today' ? moment.utc() : moment.utc(date);

	from.set('hour', 0);
	from.set('minute', 0);
	from.set('second', 0);

	var to = moment.utc(from);
	to.add('days', 1);

	report(from, to, query, function (err, report) {
		if (err) {
			logger.error(err);
			res.send(500, err);
		}

		res.json(report);
	});
});

app.get('/api/reports/week/:app', function (req, res) {
	var app = req.params.app;
	var query = {app: app};
	var date = req.query.date;

	if (!date) {
		return res.send(403, 'missing hour parameter');
	}

	if (req.query.event) {
		query.event = req.query.event;
	}

	if (req.query.id) {
		query.id = req.query.id;
	}

	var from = date === 'today' ? moment.utc() : moment.utc(date);
	var to = moment.utc(date);

	from.startOf('week');
	to.endOf('week');

	report(from, to, query, function (err, report) {
		if (err) {
			logger.error(err);
			res.send(500, err);
		}

		res.json(report);
	});
});

app.get('/api/reports/period/:app', function (req, res) {
	var app = req.params.app;
	var query = {app: app};
	var from = req.query.from;
	var to = req.query.to;

	if (!from) {
		return res.send(403, 'missing from parameter');
	}

	if (!to) {
		return res.send(403, 'missing to parameter');
	}

	if (req.query.event) {
		query.event = req.query.event;
	}

	if (req.query.id) {
		query.id = req.query.id;
	}

	from = moment.utc(from), to = moment.utc(to).add('days', 1);

	report(from, to, query, function (err, report) {
		if (err) {
			logger.error(err);
			res.send(500, err);
		}

		res.json(report);
	});
});


function report(from, to, query, callback) {
	query.timestampt = {$gte: from.toDate() , $lt: to.toDate()};

	logger.info({message: 'prepearing report', query: query});

	db.events.find(query).toArray(function (err, results) {
		if (err || !results) {
			return callback({message: 'failed to read events', err: err});
		}

		var total = results.length;
		var id = total > 0 ? results[0].id : query.id;
		var event = total > 0 ? results[0].event : query.event;

		var report =  {
			id: id,
			event: event,
			total: total
		};

		callback(null, report);
	});
}

function parseEvent(event) {
	if (typeof event === 'string') {
		return {
			id: generateIdFromName(event),
			event: event
		};
	}

	if (typeof event === 'object') {
		event.id = event.id || generateIdFromName(event.event);
		return event;
	}
}

function generateIdFromName(name) {
	return name.toLowerCase().replace(/\s/g, '-');
}

http.createServer(app).listen(app.get('port'), function() {
	var env = process.env.NODE_ENV || 'development';
	logger.info('analytics app listening on port ' + app.get('port') + ' ' + env + ' mongo: ' + config.connection);
});
