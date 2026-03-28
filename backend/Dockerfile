FROM golang:1.25.7-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080

ENV PORT=8080
CMD ["go", "run", "./src"]
