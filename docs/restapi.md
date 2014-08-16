# REST API

Here is the description of `Seismo` REST interface.

## Authentication

Clients have to authenticated in order to access API. We used simple authentication flow, based on GitHub. Authenticated users are generating [Personal Tokens](https://help.github.com/articles/creating-an-access-token-for-command-line-use).

There is a configuration file, there you specify GitHub accounts that are permitted to access API.

```js

// config.js

var config = {
	auth: {
		users: [
			'alexanderbeletsky',
			'voronianski'
		]
	}
};
```

API endpoint,

```plain
HTTP POST http://analytics.host/auth
```

```js
var payload = {
	token: 'GITHUB_PERSONAL_TOKEN'
};
```

If personal token belongs to user specified in configuration file, the permissions are granted. Access token is returned to client. Access token is used as either `X-Access-Token` request header, or `?access_token=` query parameter or `token` cookie value.

## Application ID

Application ID is association between events and application that generates it. One server could handle as many as needed.

## Posting Events

```plain
HTTP POST http://analytics.host/api/events/:app-id

{
	event: 'event',
	data: {}
}
```

With event id and event name,

```plain
HTTP POST http://analytics.host/api/events/:app-id

{
	event: {id: 'app-start', event: 'application started'},
	data: {}
}
```

With additional event payload,

```plain
HTTP POST http://analytics.host/api/events/:app-id

{
	event: 'application started',
	data: {environment: 'production'}
}
```

## Querying Events

All events generated by app,

```plain
HTTP GET http://analytics.host/api/events/:app-id
```

By event name,

```plain
HTTP GET http://analytics.host/api/events/:app-id?event=search%20executed
```

By event id,

```plain
HTTP GET http://analytics.host/api/events/:app-id?id=app-start
```

Today events,

```plain
HTTP GET http://analytics.host/api/events/:app-id?date=today
```

Or by date,

```plain
HTTP GET http://analytics.host/api/events/:app-id?date=2014-09-26
```

Or combination,

```plain
HTTP GET http://analytics.host/api/events/:app-id?event=search%20executed&date=today
```

## Building Reports

Events for one hour for given date,

```plain
HTTP GET http://analytics.host/api/reports/hour/:app-id?hour=6&date=2013-09-29
```

By given date,

```plain
HTTP GET http://analytics.host/api/reports/day/:app-id?date=2013-09-29
```

By given week,

```plain
HTTP GET http://analytics.host/api/reports/week/:app-id?week=2013-09-29
```

By given month,

```plain
HTTP GET http://analytics.host/api/reports/month/:app-id?month=2013-09-29
```

By any period,

```plain
HTTP GET http://analytics.host/api/reports/period/:app-id?from=2013-09-10&to=2013-09-13
```

## Grouping Events

By attribute,

```plain
HTTP GET http://analytics.host/api/groups/:app-id?id=user-logged&attr=email&from=2013-12-10&to=2013-12-12
```