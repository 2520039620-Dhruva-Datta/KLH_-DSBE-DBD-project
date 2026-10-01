# React REST contract

All paths below are relative to API.BASE (default `http://localhost:8080/api`). This list is generated from the method comments in `src/data/api.js`; semicolons distinguish create/update or alternate list routes.

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `POST /auth/logout`
- `PATCH /users/:id`
- `PATCH /users/:id/password`
- `GET /departments`
- `GET /departments/:id`
- `POST /departments; PUT /departments/:id`
- `DELETE /departments/:id`
- `GET /analytics/departments`
- `GET /services; GET /departments/:id/services`
- `GET /services/:id`
- `POST /services; PUT /services/:id`
- `DELETE /services/:id`
- `GET /applications`
- `GET /applications/:id`
- `GET /applications/track/:ref`
- `GET /applications/track/examples`
- `POST /applications`
- `PATCH /applications/:id/status`
- `PATCH /applications/assign`
- `GET /applications/:id/logs`
- `GET /applications/:id/documents`
- `POST /applications/:id/documents`
- `PATCH /documents/:id`
- `GET /grievances`
- `POST /grievances`
- `PATCH /grievances/:id`
- `GET /grievances/:id/logs`
- `GET /users`
- `GET /users/:id`
- `POST /users; PUT /users/:id`
- `PATCH /users/:id/status`
- `GET /analytics/overview`
- `GET /analytics/monthly`
- `GET /analytics/daily`
- `GET /analytics/status`
- `GET /analytics/departments`
- `GET /analytics/services`
- `GET /analytics/officers`
- `GET /analytics/decisions`
- `GET /analytics/processing`
- `GET /analytics/activity`
- `GET /analytics/grievances`
- `GET /analytics/sla`
- `GET /analytics/users`
- `GET /users/:id/notifications`
- `GET /users/:id/notifications/unread`
- `POST /users/:id/notifications/read`
- `GET /preferences/:key`
- `PUT /preferences/:key`
- `POST /demo/reset (development only)`
- `GET /demo/storage`

The client invalidation subscription makes no HTTP request. Preference endpoints belong to the transport contract but the demo keeps device preferences in its Store. Disable demo reset/storage routes outside development. Match field names, uppercase enum values and paged/unpaged response shapes documented in the facade.
