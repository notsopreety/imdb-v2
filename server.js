const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const cors = require('cors');
const { genre, top } = require('./id');
const { scrapeIMDBSelectedCategories } = require('./genre');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize cache with TTL of 1 hour (in seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Function to scrape genre pages
async function scrapeIMDBGenre(genreId) {
    try {
        const url = `https://www.imdb.com/interest/${genreId}/`;
        
        // Fetch the HTML content
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Load HTML content into Cheerio
        const $ = cheerio.load(data);
        
        // Initialize result object with all required fields
        const result = {
            genreTitle: '',
            coverImg: '',
            description: '',
            type: '',
            popular_movies: [],
            top_rated_movies: [],
            popular_tv_shows: [],
            top_rated_tv_shows: []
        };

        // Extract genre information
        result.genreTitle = $('div.ipc-title--category-title h3.ipc-title__text').text().trim();
        result.type = $('div.ipc-title--category-title div.ipc-title__description').text().trim();
        result.description = $('div.ipc-overflowText--pageSection div.ipc-html-content-inner-div').text().trim();
        
        // Extract and clean cover image URL
        const coverImgElement = $('div.ipc-media--dynamic img.ipc-image');
        let coverImg = coverImgElement.attr('src') || '';
        if (coverImg) {
            coverImg = coverImg.replace(/\._V1_.*\.jpg/, '.jpg');
        }
        result.coverImg = coverImg;

        // Scrape sections for popular and top-rated titles
        $('section.ipc-page-section').each((index, sectionElement) => {
            const section = $(sectionElement);
            const titleText = section.find('h3.ipc-title__text').text().trim();
            let categoryKey = '';

            // Map section titles to result object keys
            if (titleText === 'Popular movies') {
                categoryKey = 'popular_movies';
            } else if (titleText === 'Top rated movies') {
                categoryKey = 'top_rated_movies';
            } else if (titleText === 'Popular TV shows') {
                categoryKey = 'popular_tv_shows';
            } else if (titleText === 'Top rated TV shows') {
                categoryKey = 'top_rated_tv_shows';
            } else {
                return; // Skip unrecognized sections
            }

            // Extract poster cards within the section
            section.find('div.ipc-poster-card').each((i, cardElement) => {
                const card = $(cardElement);
                const titleLink = card.find('a.ipc-poster-card__title').attr('href');
                const imdbId = titleLink ? titleLink.match(/\/title\/(tt\d+)/)?.[1] : null;
                const title = card.find('span[data-testid="title"]').text().trim();
                const rating = card.find('.ipc-rating-star--rating').text().trim();
                const imageElement = card.find('.ipc-poster__poster-image img');
                let image = imageElement.attr('src') || '';

                if (image) {
                    image = image.replace(/\._V1_.*\.jpg/, '.jpg');
                }

                if (imdbId && image) {
                    result[categoryKey].push({
                        imdbId,
                        title,
                        rating,
                        image
                    });
                }
            });
        });

        return result;
    } catch (error) {
        console.error('Error scraping IMDb genre:', error.message);
        throw error;
    }
}


// Function to scrape top lists
async function scrapeTopMovies(topUrl) {
    try {
        // Fetch the HTML content
        const { data } = await axios.get(topUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Load HTML content into cheerio
        const $ = cheerio.load(data);
        
        // Result array to store all scraped data
        const topMovies = [];
        
        // Find the list container and all list items
        const selector = '#__next > main > div > div.ipc-page-content-container.ipc-page-content-container--center > section > div > div.ipc-page-grid.ipc-page-grid--bias-left > div > ul';
        
        // Track the actual rank (sequential number regardless of skipped movies)
        let rank = 1;
        
        // Find all list items within the selector
        $(`${selector} > li`).each((index, element) => {
            const movie = $(element);
            
            // Get the movie title
            const title = movie.find('.ipc-title__text').text().trim();
            
            // Get the movie link which contains the IMDb ID
            const titleLink = movie.find('.ipc-title-link-wrapper').attr('href');
            const imdbId = titleLink ? titleLink.match(/\/title\/(tt\d+)/)?.[1] : null;
            
            // Get the year
            const yearElement = movie.find('.cli-title-metadata-item').first();
            const year = yearElement ? yearElement.text().trim() : '';
            
            // Get the rating
            const rating = movie.find('.ipc-rating-star--imdb .ipc-rating-star--rating').text().trim();
            
            // Get the image URL and clean it
            const imageElement = movie.find('.ipc-image');
            let image = imageElement.attr('src') || '';
            
            // Clean the image URL by removing the size and quality parameters
            if (image) {
                const cleanedImage = image.replace(/\._V1_.*\.jpg/, '.jpg');
                image = cleanedImage;
            }
            
            // Only add if we have an IMDb ID AND an image
            if (imdbId && image) {
                topMovies.push({
                    rank: rank++, // Use the rank counter and then increment it
                    imdbId,
                    title,
                    year,
                    rating,
                    image
                });
            }
        });
        
        return topMovies;
    } catch (error) {
        console.error('Error scraping IMDb Top Movies:', error.message);
        throw error;
    }
}

// API Routes

// Get all available genres
app.get('/api/genres', (req, res) => {
    res.json(Object.keys(genre));
});

// Get all available top lists
app.get('/api/top-lists', (req, res) => {
    res.json(Object.keys(top));
});

// Get all genre at bulk

app.get('/api/genre', async (req, res) => {
    try {
        const genreData = await scrapeIMDBSelectedCategories();
        
        res.json({
            data: genreData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch genre data', message: error.message });
    }
});

// Get movies by genre
app.get('/api/genre/:genreName', async (req, res) => {
    try {
        const { genreName } = req.params;
        const genreId = genre[genreName];
        
        if (!genreId) {
            return res.status(404).json({ error: 'Genre not found' });
        }
        
        // Check if data is in cache
        const cacheKey = `genre_${genreId}`;
        let data = cache.get(cacheKey);
        
        if (!data) {
            // If not in cache, fetch and store in cache
            data = await scrapeIMDBGenre(genreId);
            cache.set(cacheKey, data);
        }
        
        res.json({
            genre: genreName,
            data
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch genre data', message: error.message });
    }
});

// Get top movies/shows
app.get('/api/top/:listName', async (req, res) => {
    try {
        const { listName } = req.params;
        const listUrl = top[listName];
        
        if (!listUrl) {
            return res.status(404).json({ error: 'List not found' });
        }
        
        // Check if data is in cache
        const cacheKey = `top_${listName.replace(/\s+/g, '_')}`;
        let data = cache.get(cacheKey);
        
        if (!data) {
            // If not in cache, fetch and store in cache
            data = await scrapeTopMovies(listUrl);
            cache.set(cacheKey, data);
        }
        
        res.json({
            list: listName,
            data
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top list data', message: error.message });
    }
});

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to IMDb Scraper API',
        endpoints: {
            genres: '/api/genres',
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