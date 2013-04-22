Talk2Us
=======
A basic form based login session using passport, to a video chat application.

The MongoDB database 'useradmin' with a collection 'Users' is used.
A sample database as shown in the below Mongo session has been used
for testing:

> use useradmin
switched to db useradmin
> db.Users.find()
{ "_id" : ObjectId("515135426f9d1c45976dcfb9"), "password" : "enaj", "role" : "provider", "userid" : "Jane" }
{ "_id" : ObjectId("5151352c6f9d1c45976dcfb8"), "display" : "Loki the Norse", "password" : "ikol", "role" : "provider", "userid" : "Loki" }
{ "_id" : ObjectId("515134dc6f9d1c45976dcfb7"), "display" : "", "password" : "funky", "role" : "provider", "userid" : "Tobi" }
>

Caveats
=======
As the site URL for the website with Facebook login is currently
http://127.0.0.1:8080/ for the Cooltalk application,
the Facebook login works only if logging in from the machine on which
the node server is running.
There should be a provider available (connected) before clicking on
Connect from a client.
Hang up before logging out.

Immediate Todo list
===================
When logging out, hang-up should also happen.
Response from websocket server should be sent to the ROOM command.
