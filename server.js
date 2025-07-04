const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const cors = require('cors');
const { genre, top } = require('./id');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const INTEREST_URL = 'https://www.imdb.com/interest/all/';

// Middleware
app.use(cors());

// Initialize cache with TTL of 1 hour (in seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// List of allowed slugs
const ALLOWED_SLUGS = [
  'popular-interests', 'action', 'adventure', 'animation', 'anime', 'comedy', 'crime',
  'documentary', 'drama', 'family', 'fantasy', 'horror', 'music', 'musical', 'mystery',
  'romance', 'sci-fi', 'sport', 'thriller', 'western'
];

// Helper: Slugify a string
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')       // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove special chars
    .replace(/-+/g, '-');       // Collapse multiple hyphens
}

// Helper: Clean image URL
function cleanImageUrl(url) {
  return url ? url.replace(/\._V1_.*\.jpg/, '.jpg') : '';
}

// Scrape selected categories from IMDb interests page
async function scrapeIMDBSelectedCategories() {
  try {
    const { data } = await axios.get(INTEREST_URL, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(data);
    const result = {};

    $('section.ipc-page-section').each((_, section) => {
      const rawCategory = $(section).find('h3.ipc-title__text').text().trim();
      const categorySlug = slugify(rawCategory);

      if (ALLOWED_SLUGS.includes(categorySlug)) {
        const items = [];

        $(section).find('div.ipc-sub-grid-item').each((_, item) => {
          const title = $(item).find('.ipc-slate-card__title-text').text().trim();
          const titleSlug = slugify(title);
          const relativeLink = $(item).find('a.ipc-lockup-overlay').attr('href') || '';
          const idMatch = relativeLink.match(/\/interest\/([^/]+)\//);
          const id = idMatch ? idMatch[1] : '';
          const image = cleanImageUrl($(item).find('img.ipc-image').attr('src') || '');

          if (title && id && image) {
            items.push({ title, slug: titleSlug, id, image });
          }
        });

        if (items.length > 0) {
          result[categorySlug] = items;
        }
      }
    });

    return result;
  } catch (error) {
    console.error('Error scraping IMDb categories:', error.message);
    throw error;
  }
}

// Scrape genre page
async function scrapeIMDBGenre(genreId) {
  try {
    const url = `https://www.imdb.com/interest/${genreId}/`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(data);

    const result = {
      genreTitle: $('div.ipc-title--category-title h3.ipc-title__text').text().trim(),
      coverImg: cleanImageUrl($('div.ipc-media--dynamic img.ipc-image').attr('src') || ''),
      description: $('div.ipc-overflowText--pageSection div.ipc-html-content-inner-div').text().trim(),
      type: $('div.ipc-title--category-title div.ipc-title__description').text().trim(),
      contents: {
        all: parseInt($('a[data-testid="chip-see-all-titles"] span.ipc-chip__count').text().trim(), 10) || 0,
        movies: parseInt($('a[data-testid="chip-see-all-movies"] span.ipc-chip__count').text().trim(), 10) || 0,
        tvShows: parseInt($('a[data-testid="chip-see-all-tv-series"] span.ipc-chip__count').text().trim(), 10) || 0
      },
      popular_movies: [],
      top_rated_movies: [],
      popular_tv_shows: [],
      top_rated_tv_shows: []
    };

    $('section.ipc-page-section').each((_, section) => {
      const titleText = $(section).find('h3.ipc-title__text').text().trim();
      let categoryKey = '';

      if (titleText === 'Popular movies') categoryKey = 'popular_movies';
      else if (titleText === 'Top rated movies') categoryKey = 'top_rated_movies';
      else if (titleText === 'Popular TV shows') categoryKey = 'popular_tv_shows';
      else if (titleText === 'Top rated TV shows') categoryKey = 'top_rated_tv_shows';
      else return;

      $(section).find('div.ipc-poster-card').each((_, card) => {
        const titleLink = $(card).find('a.ipc-poster-card__title').attr('href');
        const imdbId = titleLink ? titleLink.match(/\/title\/(tt\d+)/)?.[1] : null;
        const title = $(card).find('span[data-testid="title"]').text().trim();
        const rating = $(card).find('.ipc-rating-star--rating').text().trim();
        const image = cleanImageUrl($(card).find('.ipc-poster__poster-image img').attr('src') || '');

        if (imdbId && image) {
          result[categoryKey].push({ imdbId, title, rating, image });
        }
      });
    });

    return result;
  } catch (error) {
    console.error('Error scraping IMDb genre:', error.message);
    throw error;
  }
}

// Scrape top movies or shows
async function scrapeTopMovies(topUrl) {
  try {
    const { data } = await axios.get(topUrl, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(data);
    const topMovies = [];
    let rank = 1;

    $('ul.ipc-metadata-list > li').each((_, movie) => {
      const title = $(movie).find('.ipc-title__text').text().trim();
      const titleLink = $(movie).find('.ipc-title-link-wrapper').attr('href');
      const imdbId = titleLink ? titleLink.match(/\/title\/(tt\d+)/)?.[1] : null;
      const year = $(movie).find('.cli-title-metadata-item').first().text().trim();
      const rating = $(movie).find('.ipc-rating-star--rating').text().trim();
      const image = cleanImageUrl($(movie).find('.ipc-image').attr('src') || '');

      if (imdbId && image) {
        topMovies.push({ rank: rank++, imdbId, title, year, rating, image });
      }
    });

    return topMovies;
  } catch (error) {
    console.error('Error scraping IMDb top list:', error.message);
    throw error;
  }
}

// API Routes
app.get('/api/genres', (req, res) => {
  res.json(Object.keys(genre));
});

app.get('/api/top-lists', (req, res) => {
  res.json(Object.keys(top));
});

app.get('/api/genre', async (req, res) => {
  try {
    const genreData = await scrapeIMDBSelectedCategories();
    res.json({ data: genreData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch genre data', message: error.message });
  }
});

app.get('/api/genre/:genreName', async (req, res) => {
  try {
    const { genreName } = req.params;
    const genreId = genre[genreName];
    if (!genreId) return res.status(404).json({ error: 'Genre not found' });

    const cacheKey = `genre_${genreId}`;
    let data = cache.get(cacheKey) || (await scrapeIMDBGenre(genreId).then(data => cache.set(cacheKey, data) && data));

    res.json({ genre: genreName, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch genre data', message: error.message });
  }
});

app.get('/api/top/:listName', async (req, res) => {
  try {
    const { listName } = req.params;
    const listUrl = top[listName];
    if (!listUrl) return res.status(404).json({ error: 'List not found' });

    const cacheKey = `top_${listName}`;
    let data = cache.get(cacheKey) || (await scrapeTopMovies(listUrl).then(data => cache.set(cacheKey, data) && data));

    res.json({ list: listName, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top list data', message: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to IMDb Scraper API',
    endpoints: {
      genres: '/api/genres',
      genresAtBulk: '/api/genre',
      genre: '/api/genre/:genreName',
      topLists: '/api/top-lists',
      top: '/api/top/:listName'
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});