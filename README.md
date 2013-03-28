Talk2Us
=======
A basic form based login session using passport.

The MongoDB database 'useradmin' with a collection 'Users' is used.
A sample database as shown in the below Mongo session has been used
for testing:

> use useradmin
switched to db useradmin
> db.Users.find()
{ "_id" : ObjectId("515134dc6f9d1c45976dcfb7"), "username" : "Tobi", "password" : "funky" }
{ "_id" : ObjectId("5151352c6f9d1c45976dcfb8"), "username" : "Loki", "password" : "ikol" }
{ "_id" : ObjectId("515135426f9d1c45976dcfb9"), "username" : "Jane", "password" : "enaj" }

