# IMDb Scraper API

A Node.js application to scrape movie data from IMDb and serve it through a REST API.

## Features

- Scrape movies by genre from IMDb interest pages
- Scrape IMDb Top 250 movies list
- Scrape popular movies and TV shows
- REST API with caching to reduce latency
- Easy access to multiple IMDb lists

## Installation

1. Clone this repository
2. Install dependencies:
```
npm install
```

## Usage

### Start the API Server

```
npm start
```

Or for development with auto-reload:

```
npm run dev
```

The server will start on port 3000 by default (or the port specified in the PORT environment variable).

### API Endpoints

- `GET /` - Welcome page with API information
- `GET /api/genres` - List all available genres
- `GET /api/genre/:genreName` - Get movies and shows for a specific genre
- `GET /api/top-lists` - List all available top lists
- `GET /api/top/:listName` - Get movies/shows from a specific top list

### Run Individual Scrapers

To run the genre scraper directly:

```
npm run start:genre
```

To run the top movies/shows scraper directly:

```
npm run start:top
```

## Data Format

### Genre Response

```json
{
  "genre": "Comedy",
  "data": {
    "popular_movies": [
      {
        "imdbId": "tt1234567",
        "title": "Movie Title",
        "rating": "8.5",
        "image": "https://m.media-amazon.com/images/M/..."
      }
    ],
    "top_rated_movies": [...],
    "popular_tv_shows": [...],
    "top_rated_tv_shows": [...]
  }
}
```

### Top List Response

```json
{
  "list": "Top Popular Movies",
  "data": [
    {
      "rank": 1,
      "imdbId": "tt1234567",
      "title": "Movie Title",
      "year": "2023",
      "rating": "8.5",
      "image": "https://m.media-amazon.com/images/M/..."
    }
  ]
}
```

## Caching

The API uses in-memory caching to reduce latency and minimize requests to IMDb. Cache entries expire after 1 hour.

## Dependencies

- express - Web server framework
- axios - For making HTTP requests
- cheerio - For parsing HTML and extracting data
- node-cache - For in-memory caching
- cors - For enabling CORS 