- Before building out this backend, we will need to be getting data from the sensors, which we do not have. so.... with this is mind, the current ideas of the backend is to be exposing sample data that the frontend can grab for rendering proof of concept. 

- We are already spinning up an http server on 8008, so we can just add an endpoint there to send fake temp fan and rotation data. 

- 03/28/26 Current state, we now have mock data being spun up on the backend, so the frontend can grab this from the /mock endpoint. I do not want to work on the frontend right now. I want to rewrite the frontend in typescript or maybe even a mobile focued language because php isnt really the most ideal for the purpose of rendering graphs and such in a mobile focused way. We will get to that later, but for now:

    - endpoint for mock data is available at: http://localhost:8008/mock so when we curl it we get this response:

    ```
    { "temperature": 430, "motor_rpm": 273, "fan_rpm": 1619 }
    
    ```
    - This is good enough for now. Randomness doesnt need to be perfect, just needs to be ballpark of real numbers we would see. Ints are nice for this, I am not exactly sure how precise we want to go with the measurements, especially since we do not have real sensors to test reading etc from. Ints it is.

- With the backend returning mock data, we can now work on the frontend to read and render this data. The way that we will do this is by using a simple fetch req that runs every x ms to grab the data from the "sensors" and then slap it onto the screen. rendering into a graph is more work and will likely be done with a lib that I haven't yet researched enough. Doing so from scratch would be cool, but I am not sure how to even approach this, as the scale of this would be pretty big for a project of this scope.

- TODO: figure out what I want to do with the frontend. keep running web and use typescript + tailwind or go the more mobile dedicated appraoch?....... 


