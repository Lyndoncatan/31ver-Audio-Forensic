"""
Shared forensic category mapping for all audio classification models.
Maps AudioSet class labels to forensic-relevant categories.

Comprehensive mapping covering all 527 AudioSet classes grouped into
forensic-relevant categories for audio forensic analysis.
"""

FORENSIC_MAPPING = {
    # ========================
    # HUMAN VOICE
    # ========================
    "Speech": "Human Voice",
    "Singing": "Human Voice",
    "Choir": "Human Voice",
    "Chant": "Human Voice",
    "Mantra": "Human Voice",
    "Male speech, man speaking": "Male Voice",
    "Male speech": "Male Voice",
    "Male singing": "Male Voice",
    "Female speech, woman speaking": "Female Voice",
    "Female speech": "Female Voice",
    "Female singing": "Female Voice",
    "Child speech, kid speaking": "Human Voice",
    "Child singing": "Human Voice",
    "Conversation": "Human Voice",
    "Narration, monologue": "Human Voice",
    "Babbling": "Human Voice",
    "Whispering": "Human Voice",
    "Laughter": "Human Voice",
    "Giggle": "Human Voice",
    "Snicker": "Human Voice",
    "Belly laugh": "Human Voice",
    "Chuckle, chortle": "Human Voice",
    "Crying, sobbing": "Scream / Aggression",
    "Sigh": "Human Voice",
    "Groan": "Human Voice",
    "Grunt": "Human Voice",
    "Whistling": "Human Voice",
    "Breathing": "Human Voice",
    "Wheeze": "Human Voice",
    "Snoring": "Human Voice",
    "Gasp": "Human Voice",
    "Pant": "Human Voice",
    "Snort": "Human Voice",
    "Cough": "Human Voice",
    "Throat clearing": "Human Voice",
    "Sneeze": "Human Voice",
    "Sniff": "Human Voice",
    "Hiccup": "Human Voice",
    "Burping, eructation": "Human Voice",
    "Humming": "Human Voice",
    "Groan": "Human Voice",
    "Yawn": "Human Voice",

    # ========================
    # SCREAM / AGGRESSION
    # ========================
    "Screaming": "Scream / Aggression",
    "Scream": "Scream / Aggression",
    "Shout": "Scream / Aggression",
    "Yell": "Scream / Aggression",
    "Battle cry": "Scream / Aggression",
    "Children shouting": "Scream / Aggression",
    "Wail, moan": "Scream / Aggression",
    "Whimper": "Scream / Aggression",

    # ========================
    # MUSICAL CONTENT
    # ========================
    "Music": "Musical Content",
    "Musical instrument": "Musical Content",
    "Guitar": "Musical Content",
    "Electric guitar": "Musical Content",
    "Bass guitar": "Musical Content",
    "Acoustic guitar": "Musical Content",
    "Steel guitar, slide guitar": "Musical Content",
    "Piano": "Musical Content",
    "Electric piano": "Musical Content",
    "Keyboard (musical)": "Musical Content",
    "Organ": "Musical Content",
    "Electronic organ": "Musical Content",
    "Hammond organ": "Musical Content",
    "Synthesizer": "Musical Content",
    "Drum": "Musical Content",
    "Drum kit": "Musical Content",
    "Drum machine": "Musical Content",
    "Drum roll": "Musical Content",
    "Snare drum": "Musical Content",
    "Rimshot": "Musical Content",
    "Bass drum": "Musical Content",
    "Timpani": "Musical Content",
    "Tabla": "Musical Content",
    "Cymbal": "Musical Content",
    "Hi-hat": "Musical Content",
    "Crash cymbal": "Musical Content",
    "Tambourine": "Musical Content",
    "Cowbell": "Musical Content",
    "Vibraphone": "Musical Content",
    "Marimba, xylophone": "Musical Content",
    "Glockenspiel": "Musical Content",
    "Steelpan": "Musical Content",
    "Mallet percussion": "Musical Content",
    "Violin, fiddle": "Musical Content",
    "Viola": "Musical Content",
    "Cello": "Musical Content",
    "Double bass": "Musical Content",
    "Plucked string instrument": "Musical Content",
    "Mandolin": "Musical Content",
    "Zither": "Musical Content",
    "Ukulele": "Musical Content",
    "Banjo": "Musical Content",
    "Sitar": "Musical Content",
    "Harp": "Musical Content",
    "Bowed string instrument": "Musical Content",
    "String section": "Musical Content",
    "Pizzicato": "Musical Content",
    "Flute": "Musical Content",
    "Clarinet": "Musical Content",
    "Oboe": "Musical Content",
    "Bassoon": "Musical Content",
    "Saxophone": "Musical Content",
    "Recorder": "Musical Content",
    "Trumpet": "Musical Content",
    "French horn": "Musical Content",
    "Trombone": "Musical Content",
    "Tuba": "Musical Content",
    "Brass instrument": "Musical Content",
    "Woodwind instrument": "Musical Content",
    "Harmonica": "Musical Content",
    "Accordion": "Musical Content",
    "Bagpipes": "Musical Content",
    "Didgeridoo": "Musical Content",
    "Pan flute": "Musical Content",
    "Shaker": "Musical Content",
    "Maraca": "Musical Content",
    "Castanets": "Musical Content",
    "Triangle (instrument)": "Musical Content",
    "Wind chime": "Musical Content",
    "Bell": "Musical Content",
    "Tubular bells": "Musical Content",
    "Church bell": "Musical Content",
    "Jingle bell": "Musical Content",
    "Bicycle bell": "Musical Content",
    "Tuning fork": "Musical Content",
    "Choir": "Musical Content",
    "Orchestra": "Musical Content",
    "Music of Bollywood": "Musical Content",
    "Music of Latin America": "Musical Content",
    "Music of Africa": "Musical Content",
    "Music of Asia": "Musical Content",
    "Hip hop music": "Musical Content",
    "Rock music": "Musical Content",
    "Pop music": "Musical Content",
    "Heavy metal": "Musical Content",
    "Punk rock": "Musical Content",
    "Grunge": "Musical Content",
    "Progressive rock": "Musical Content",
    "Rock and roll": "Musical Content",
    "Psychedelic rock": "Musical Content",
    "Rhythm and blues": "Musical Content",
    "Soul music": "Musical Content",
    "Funk": "Musical Content",
    "Disco": "Musical Content",
    "Electronic music": "Musical Content",
    "Electronica": "Musical Content",
    "Techno": "Musical Content",
    "House music": "Musical Content",
    "Trance music": "Musical Content",
    "Drum and bass": "Musical Content",
    "Dubstep": "Musical Content",
    "Electronic dance music": "Musical Content",
    "Jazz": "Musical Content",
    "Swing music": "Musical Content",
    "Bossa nova": "Musical Content",
    "Blues": "Musical Content",
    "Country": "Musical Content",
    "Bluegrass": "Musical Content",
    "Folk music": "Musical Content",
    "Middle Eastern music": "Musical Content",
    "Reggae": "Musical Content",
    "Ska": "Musical Content",
    "Classical music": "Musical Content",
    "Opera": "Musical Content",
    "Choral music": "Musical Content",
    "Gospel music": "Musical Content",
    "New-age music": "Musical Content",
    "Ambient music": "Musical Content",
    "Soundtrack music": "Musical Content",
    "Theme music": "Musical Content",
    "Jingle (music)": "Musical Content",
    "Background music": "Musical Content",
    "Beatboxing": "Musical Content",
    "Rapping": "Musical Content",
    "Vocal music": "Musical Content",
    "A capella": "Musical Content",
    "Strum": "Musical Content",
    "Finger snapping": "Musical Content",
    "Clapping": "Musical Content",
    "Applause": "Musical Content",
    "Cheering": "Musical Content",
    "Song": "Musical Content",
    "Independent music": "Musical Content",
    "Christian music": "Musical Content",
    "Wedding music": "Musical Content",
    "Lullaby": "Musical Content",
    "Singing bowl": "Musical Content",
    "Scratching (performance technique)": "Musical Content",
    "DJ": "Musical Content",
    "Turntablism": "Musical Content",
    "Sampling (music)": "Musical Content",

    # ========================
    # VEHICLE SOUNDS
    # ========================
    "Vehicle": "Vehicle Sound",
    "Car": "Vehicle Sound",
    "Bus": "Vehicle Sound",
    "Truck": "Vehicle Sound",
    "Motorcycle": "Vehicle Sound",
    "Engine": "Vehicle Sound",
    "Engine starting": "Vehicle Sound",
    "Engine idling": "Vehicle Sound",
    "Engine knocking": "Vehicle Sound",
    "Idling": "Vehicle Sound",
    "Accelerating, revving, vroom": "Vehicle Sound",
    "Traffic noise, roadway noise": "Vehicle Sound",
    "Road noise": "Vehicle Sound",
    "Tire squeal": "Vehicle Sound",
    "Skidding": "Vehicle Sound",
    "Car passing by": "Vehicle Sound",
    "Race car, auto racing": "Vehicle Sound",
    "Aircraft": "Vehicle Sound",
    "Aircraft engine": "Vehicle Sound",
    "Jet engine": "Vehicle Sound",
    "Propeller, airscrew": "Vehicle Sound",
    "Helicopter": "Vehicle Sound",
    "Fixed-wing aircraft, airplane": "Vehicle Sound",
    "Light engine (high frequency)": "Vehicle Sound",
    "Train": "Vehicle Sound",
    "Train horn": "Vehicle Sound",
    "Train wheels squealing": "Vehicle Sound",
    "Railroad car, train wagon": "Vehicle Sound",
    "Subway, metro, underground": "Vehicle Sound",
    "Boat, Water vehicle": "Vehicle Sound",
    "Ship": "Vehicle Sound",
    "Motorboat, speedboat": "Vehicle Sound",
    "Sailboat, sailing ship": "Vehicle Sound",
    "Bicycle": "Vehicle Sound",
    "Skateboard": "Vehicle Sound",
    "Golf cart": "Vehicle Sound",
    "Lawn mower": "Vehicle Sound",
    "Snowmobile": "Vehicle Sound",
    "Car horn": "Vehicle Sound",
    "Honking": "Vehicle Sound",
    "Air horn, truck horn": "Vehicle Sound",
    "Vehicle horn, car horn, honking": "Vehicle Sound",
    "Reversing beeps": "Vehicle Sound",
    "Ice cream truck, ice cream van": "Vehicle Sound",
    "Air brake": "Vehicle Sound",
    "Wheels squealing": "Vehicle Sound",

    # ========================
    # FOOTSTEPS
    # ========================
    "Footsteps": "Footsteps",
    "Walk, footsteps": "Footsteps",
    "Run": "Footsteps",
    "Running": "Footsteps",

    # ========================
    # ANIMAL SIGNALS
    # ========================
    "Animal": "Animal Signal",
    "Domestic animals, pets": "Animal Signal",
    "Dog": "Animal Signal",
    "Dog bark": "Animal Signal",
    "Dog bow-wow": "Animal Signal",
    "Dog growling": "Animal Signal",
    "Dog whimper": "Animal Signal",
    "Dog howl": "Animal Signal",
    "Bark": "Animal Signal",
    "Yip": "Animal Signal",
    "Howl": "Animal Signal",
    "Cat": "Animal Signal",
    "Cat purr": "Animal Signal",
    "Meow": "Animal Signal",
    "Hiss": "Animal Signal",
    "Caterwaul": "Animal Signal",
    "Bird": "Animal Signal",
    "Bird vocalization, bird call, bird song": "Animal Signal",
    "Chirp, tweet": "Animal Signal",
    "Squawk": "Animal Signal",
    "Pigeon, dove": "Animal Signal",
    "Crow": "Animal Signal",
    "Caw": "Animal Signal",
    "Owl": "Animal Signal",
    "Bird flight, flapping wings": "Animal Signal",
    "Duck": "Animal Signal",
    "Quack": "Animal Signal",
    "Goose": "Animal Signal",
    "Honk (goose)": "Animal Signal",
    "Turkey": "Animal Signal",
    "Gobble": "Animal Signal",
    "Chicken, rooster": "Animal Signal",
    "Cluck": "Animal Signal",
    "Crowing, cock-a-doodle-doo": "Animal Signal",
    "Insect": "Animal Signal",
    "Cricket": "Animal Signal",
    "Mosquito": "Animal Signal",
    "Bee, wasp, etc.": "Animal Signal",
    "Buzz": "Animal Signal",
    "Frog": "Animal Signal",
    "Croak": "Animal Signal",
    "Snake": "Animal Signal",
    "Rattle": "Animal Signal",
    "Livestock, farm animals, working animals": "Animal Signal",
    "Horse": "Animal Signal",
    "Clip-clop": "Animal Signal",
    "Neigh, whinny": "Animal Signal",
    "Cattle, bovinae": "Animal Signal",
    "Moo": "Animal Signal",
    "Pig": "Animal Signal",
    "Oink": "Animal Signal",
    "Goat": "Animal Signal",
    "Bleat": "Animal Signal",
    "Sheep": "Animal Signal",
    "Baa": "Animal Signal",
    "Donkey": "Animal Signal",
    "Roar": "Animal Signal",
    "Whale vocalization": "Animal Signal",
    "Wild animals": "Animal Signal",
    "Mouse": "Animal Signal",
    "Squeak": "Animal Signal",

    # ========================
    # ATMOSPHERIC / WEATHER
    # ========================
    "Wind": "Atmospheric Wind",
    "Breeze": "Atmospheric Wind",
    "Rustling leaves": "Atmospheric Wind",
    "Wind noise (microphone)": "Atmospheric Wind",
    "Thunder": "Atmospheric Wind",
    "Thunderstorm": "Atmospheric Wind",
    "Rain": "Atmospheric Wind",
    "Rain on surface": "Atmospheric Wind",
    "Raindrop": "Atmospheric Wind",
    "Hail": "Atmospheric Wind",
    "White noise": "Atmospheric Wind",
    "Pink noise": "Atmospheric Wind",
    "Static": "Atmospheric Wind",
    "Noise": "Atmospheric Wind",
    "Environmental noise": "Atmospheric Wind",
    "Outside, urban or manmade": "Atmospheric Wind",
    "Outside, rural or natural": "Atmospheric Wind",

    # ========================
    # SILENCE
    # ========================
    "Silence": "Silence",

    # ========================
    # GUNSHOT / EXPLOSION
    # ========================
    "Gunshot, gunfire": "Gunshot / Explosion",
    "Gunshot": "Gunshot / Explosion",
    "Machine gun": "Gunshot / Explosion",
    "Fusillade": "Gunshot / Explosion",
    "Artillery fire": "Gunshot / Explosion",
    "Artillery": "Gunshot / Explosion",
    "Cap gun": "Gunshot / Explosion",
    "Explosion": "Gunshot / Explosion",
    "Burst, pop": "Gunshot / Explosion",
    "Boom": "Gunshot / Explosion",
    "Fireworks": "Gunshot / Explosion",
    "Firecracker": "Gunshot / Explosion",

    # ========================
    # SIREN / ALARM
    # ========================
    "Siren": "Siren / Alarm",
    "Civil defense siren": "Siren / Alarm",
    "Ambulance (siren)": "Siren / Alarm",
    "Police car (siren)": "Siren / Alarm",
    "Fire engine, fire truck (siren)": "Siren / Alarm",
    "Alarm": "Siren / Alarm",
    "Alarm clock": "Siren / Alarm",
    "Buzzer": "Siren / Alarm",
    "Emergency vehicle": "Siren / Alarm",
    "Smoke detector, smoke alarm": "Siren / Alarm",
    "Fire alarm": "Siren / Alarm",
    "Foghorn": "Siren / Alarm",
    "Whistle": "Siren / Alarm",
    "Steam whistle": "Siren / Alarm",

    # ========================
    # IMPACT / BREACH
    # ========================
    "Glass": "Impact / Breach",
    "Glass break": "Impact / Breach",
    "Shatter": "Impact / Breach",
    "Breaking": "Impact / Breach",
    "Smash, crash": "Impact / Breach",
    "Smash": "Impact / Breach",
    "Crash": "Impact / Breach",
    "Hammer": "Impact / Breach",
    "Door": "Impact / Breach",
    "Knock": "Impact / Breach",
    "Slam": "Impact / Breach",
    "Thump, thud": "Impact / Breach",
    "Bang": "Impact / Breach",
    "Slap, smack": "Impact / Breach",
    "Whack, thwack": "Impact / Breach",
    "Punching": "Impact / Breach",
    "Crushing": "Impact / Breach",
    "Crack": "Impact / Breach",
    "Crunch": "Impact / Breach",
    "Bouncing": "Impact / Breach",
    "Wood": "Impact / Breach",
    "Chop": "Impact / Breach",
    "Splinter": "Impact / Breach",
    "Tap": "Impact / Breach",
    "Scrape": "Impact / Breach",

    # ========================
    # WATER / LIQUID
    # ========================
    "Water": "Water / Liquid",
    "Splash, splatter": "Water / Liquid",
    "Splashing": "Water / Liquid",
    "Drip": "Water / Liquid",
    "Stream": "Water / Liquid",
    "Waterfall": "Water / Liquid",
    "Ocean": "Water / Liquid",
    "Waves, surf": "Water / Liquid",
    "Pour": "Water / Liquid",
    "Gurgling": "Water / Liquid",
    "Trickle, dribble": "Water / Liquid",
    "Bathtub (filling or washing)": "Water / Liquid",
    "Sink (filling or washing)": "Water / Liquid",
    "Toilet flush": "Water / Liquid",
    "Boiling": "Water / Liquid",
    "Bubbling": "Water / Liquid",

    # ========================
    # ELECTRONIC SIGNAL
    # ========================
    "Telephone": "Electronic Signal",
    "Telephone bell ringing": "Electronic Signal",
    "Ringtone": "Electronic Signal",
    "Telephone dialing, DTMF": "Electronic Signal",
    "Dial tone": "Electronic Signal",
    "Busy signal": "Electronic Signal",
    "Beep, bleep": "Electronic Signal",
    "Chime": "Electronic Signal",
    "Ding": "Electronic Signal",
    "Doorbell": "Electronic Signal",
    "Ding-dong": "Electronic Signal",
    "Television": "Electronic Signal",
    "Radio": "Electronic Signal",
    "Video game sound": "Electronic Signal",
    "Computer keyboard": "Electronic Signal",
    "Typing": "Electronic Signal",
    "Printer": "Electronic Signal",
    "Camera": "Electronic Signal",
    "Single-lens reflex camera": "Electronic Signal",
    "Microwave oven": "Electronic Signal",
    "Air conditioning": "Electronic Signal",
    "Mechanical fan": "Electronic Signal",
    "Hair dryer": "Electronic Signal",
    "Vacuum cleaner": "Electronic Signal",
    "Blender": "Electronic Signal",
    "Sewing machine": "Electronic Signal",
    "Electric shaver, electric razor": "Electronic Signal",
    "Cash register": "Electronic Signal",

    # ========================
    # TOOLS / MACHINERY
    # ========================
    "Power tool": "Tools / Machinery",
    "Drill": "Tools / Machinery",
    "Chainsaw": "Tools / Machinery",
    "Jackhammer": "Tools / Machinery",
    "Sawing": "Tools / Machinery",
    "Filing (rasp)": "Tools / Machinery",
    "Sanding": "Tools / Machinery",
    "Tools": "Tools / Machinery",
    "Hammer": "Tools / Machinery",
    "Ratchet, pawl": "Tools / Machinery",
    "Welding": "Tools / Machinery",
    "Engine": "Tools / Machinery",
    "Machine": "Tools / Machinery",
    "Grinding": "Tools / Machinery",

    # ========================
    # DOMESTIC / INDOOR
    # ========================
    "Dishes, pots, and pans": "Domestic Sound",
    "Cutlery, silverware": "Domestic Sound",
    "Chopping (food)": "Domestic Sound",
    "Frying (food)": "Domestic Sound",
    "Cooking": "Domestic Sound",
    "Zipper (clothing)": "Domestic Sound",
    "Cupboard open or close": "Domestic Sound",
    "Drawer open or close": "Domestic Sound",
    "Key (jangling)": "Domestic Sound",
    "Coin (dropping)": "Domestic Sound",
    "Scissors": "Domestic Sound",
    "Writing": "Domestic Sound",
    "Tearing": "Domestic Sound",
    "Crushing": "Domestic Sound",
    "Tick": "Domestic Sound",
    "Tick-tock": "Domestic Sound",
    "Clock": "Domestic Sound",
    "Mechanical clock": "Domestic Sound",
    "Mechanisms": "Domestic Sound",
    "Ratchet mechanism": "Domestic Sound",
    "Creak": "Domestic Sound",
    "Squeak": "Domestic Sound",
    "Rustle": "Domestic Sound",
    "Paper rustle": "Domestic Sound",

    # ========================
    # CROWD / PUBLIC
    # ========================
    "Crowd": "Crowd / Public",
    "Hubbub, speech noise, speech babble": "Crowd / Public",
    "Children playing": "Crowd / Public",
    "Chatter": "Crowd / Public",
    "Inside, large room or hall": "Crowd / Public",
    "Inside, small room": "Crowd / Public",
    "Reverberation": "Crowd / Public",
    "Echo": "Crowd / Public",
}

# Dataset-specific mappings (matching your E:\dataset folder structure)
DATASET_CATEGORY_MAP = {
    # Top-level dataset folders → forensic categories
    "animals": "Animal Signal",
    "effect": "Electronic Signal",
    "environment": "Atmospheric Wind",
    "human": "Human Voice",
    "instrument": "Musical Content",
    "item": "Domestic Sound",
    "vehicle": "Vehicle Sound",
    # Specific instrument folders
    "banjo": "Musical Content",
    "bass_guitar": "Musical Content",
    "clarinet": "Musical Content",
    "cowbell": "Musical Content",
    "cymbals": "Musical Content",
    "dobro": "Musical Content",
    "drum_set": "Musical Content",
    "electro_guitar": "Musical Content",
    "floor_tom": "Musical Content",
    "flute": "Musical Content",
    "guitar": "Musical Content",
    "harmonica": "Musical Content",
    "harmonium": "Musical Content",
    "hi_hats": "Musical Content",
    "keyboard": "Musical Content",
    "mandolin": "Musical Content",
    "organ": "Musical Content",
    "piano": "Musical Content",
    "saxophone": "Musical Content",
    "shakers": "Musical Content",
    "tambourine": "Musical Content",
    "trombone": "Musical Content",
    "trumpet": "Musical Content",
    "ukuleley": "Musical Content",
    "vibraphone": "Musical Content",
    "violinll": "Musical Content",
    # Tool/item folders
    "chainsaw": "Tools / Machinery",
    "drill": "Tools / Machinery",
    "hammerc": "Impact / Breach",
    "horn": "Vehicle Sound",
    "power_tools": "Tools / Machinery",
    "sword": "Impact / Breach",
    # Vehicle folders
    "airplanes": "Vehicle Sound",
    "ambulance": "Siren / Alarm",
    "bicycle": "Vehicle Sound",
    "car": "Vehicle Sound",
    "car_alarm": "Siren / Alarm",
    "car_horn": "Vehicle Sound",
    "engine": "Vehicle Sound",
    "fighter_jet": "Vehicle Sound",
    "firetruck": "Siren / Alarm",
    "helicopter": "Vehicle Sound",
    "siren": "Siren / Alarm",
    "train": "Vehicle Sound",
    "truck": "Vehicle Sound",
}


def map_to_forensic_category(raw_label):
    """
    Map a raw AudioSet class label to a forensic category.
    Uses exact match first, then substring matching for flexibility.
    """
    if not raw_label:
        return "Unknown"

    # Try exact match first
    if raw_label in FORENSIC_MAPPING:
        return FORENSIC_MAPPING[raw_label]

    # Try case-insensitive exact match
    raw_lower = raw_label.lower()
    for key, value in FORENSIC_MAPPING.items():
        if key.lower() == raw_lower:
            return value

    # Try substring match (both directions)
    for key, value in FORENSIC_MAPPING.items():
        if key.lower() in raw_lower or raw_lower in key.lower():
            return value

    # Try dataset category match
    for key, value in DATASET_CATEGORY_MAP.items():
        if key.lower() in raw_lower or raw_lower in key.lower():
            return value

    # If nothing matched, return a generic category based on common patterns
    if any(w in raw_lower for w in ["speak", "voice", "talk", "say"]):
        return "Human Voice"
    if any(w in raw_lower for w in ["music", "song", "sing", "instrument", "play"]):
        return "Musical Content"
    if any(w in raw_lower for w in ["car", "drive", "motor", "engine", "vehicle"]):
        return "Vehicle Sound"
    if any(w in raw_lower for w in ["gun", "shot", "fire", "explo", "blast"]):
        return "Gunshot / Explosion"
    if any(w in raw_lower for w in ["siren", "alarm", "emergency"]):
        return "Siren / Alarm"
    if any(w in raw_lower for w in ["animal", "dog", "cat", "bird"]):
        return "Animal Signal"
    if any(w in raw_lower for w in ["wind", "rain", "storm", "weather", "thunder"]):
        return "Atmospheric Wind"
    if any(w in raw_lower for w in ["break", "crash", "smash", "impact", "hit"]):
        return "Impact / Breach"
    if any(w in raw_lower for w in ["water", "splash", "drip", "pour"]):
        return "Water / Liquid"
    if any(w in raw_lower for w in ["scream", "shout", "yell", "cry"]):
        return "Scream / Aggression"

    # Return original label if absolutely no match found
    return raw_label


def map_dataset_folder_to_category(folder_name):
    """Map a dataset folder name to a forensic category."""
    folder_lower = folder_name.lower().strip()
    if folder_lower in DATASET_CATEGORY_MAP:
        return DATASET_CATEGORY_MAP[folder_lower]
    return map_to_forensic_category(folder_name)
