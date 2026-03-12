- Before building out this backend, we will need to be getting data from the sensors, which we do not have. so.... with this is mind, the current ideas of the backend is to be exposing sample data that the frontend can grab for rendering proof of concept. 

- We are already spinning up an http server on 8008, so we can just add an endpoint there to send fake temp fan and rotation data. 


- Temperature should be between 375 and 450 ish, no idea what fans and rotation should be, but we can just make some shit up
