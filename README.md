# app-database-controller
Database Controller

* node index.js

* redis-cli, set "next_user_id" 0,  set "next_video_id" 0

* Test with : curl -d '{"role":"user","cmd":"add-uploader","user":{"name":"momonta"},"video":{"title": "myvideo", "tags":"test"}}' http://localhost:10101/act

* See changes : redis-cli, keys * , hgetall ...etc
