const genre = {
    "action": "in0000001",
    "adventure": "in0000012",
    "animation": "in0000026",
    "anime": "in0000027",
    "comedy": "in0000034",
    "crime": "in0000052",
    "documentary": "in0000060",
    "drama": "in0000076",
    "family": "in0000093",
    "fantasy": "in0000098",
    "horror": "in0000112",
    "music": "in0000130",
    "musical": "in0000133",
    "mystery": "in0000139",
    "romance": "in0000152",
    "sci-fi": "in0000162",
    "sport": "in0000174",
    "thriller": "in0000186",
    "western": "in0000191"
}

const top = {
    "top-popular-movies": "https://www.imdb.com/chart/moviemeter/?ref_=nv_mv_mpm&sort=rank%2Casc",
    "top-rated-movies": "https://www.imdb.com/chart/top/?ref_=nv_mv_250&sort=user_rating%2Cdesc",
    "top-rated-tv-shows": "https://www.imdb.com/chart/toptv/?ref_=nv_tvv_250&sort=user_rating%2Cdesc",
    "top-popular-tv-shows": "https://www.imdb.com/chart/tvmeter/?ref_=nv_tvv_mptv"
}

module.exports = { genre, top };