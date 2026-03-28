// this file contains mock data for testing purpose where the embedded portion of the machine is inoperable. 
// here we define a struct for mock data: temperature, motor rpm, and fan rpm, and then create a function to generate mock data for these fields. This will allow us to make and test api calls that our embeddded system would normally handle without the need for the actual hardware.
package data

import (
	"math/rand"
	"time"
)

type MockData struct {
	Temperature int `json:"temperature"`
	MotorRPM    int     `json:"motor_rpm"`
	FanRPM      int     `json:"fan_rpm"`
}

func GenerateMockData() MockData {
	rand.Seed(time.Now().UnixNano()) // outdated but not a big deal here. randomness doesnt matter much for this purpose.
	return MockData{
		Temperature: 350 + rand.Intn(100),	// random temp between 350 and 450
		MotorRPM:    100 + rand.Intn(200),	// random motor rpm between 100 and 300
		FanRPM:      600 + rand.Intn(1200),	// random fan rpm between 600 and 1800
	}
}
