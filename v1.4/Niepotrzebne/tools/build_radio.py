# Costa del Gzowo: mixes Blend library stems into full tracks and writes the per-station track list for the car radio.
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "music")
LIBRARY = os.path.expanduser("~/Music/Blend/Library")
EXTRA = os.path.join(ROOT, "Niepotrzebne", "muzyka")

STATIONS = {
    "riviera": ["Daft Punk - Around the World", "Daft Punk - Da Funk", "Daft Punk - Harder, Better, Faster, Stronger", "Daft Punk - One More Time", "Justice - D.A.N.C.E.", "Justice - We Are Your Friends", "Modjo - Lady (Hear Me Tonight)", "Stardust - Music Sounds Better with You", "Bob Sinclar - Love Generation", "Bob Sinclar - World, Hold On", "Martin Solveig - Hello", "Discobitch - C'est beau la bourgeoisie", "Michael Gray - The Weekend", "Supermode - Tell Me Why"],
    "costa-club": ["Avicii - Levels", "Avicii - Wake Me Up", "Calvin Harris - Feel So Close", "Calvin Harris - Summer", "Eric Prydz - Call on Me", "Eric Prydz - Pjanoo", "FISHER - Losing It", "Swedish House Mafia - Don't You Worry Child", "Swedish House Mafia - One (Your Name)", "Yves Larock - Rise Up", "Empire of the Sun - We Are the People"],
    "euro-9x": ["Darude - Sandstorm", "Eiffel 65 - Blue (Da Ba Dee)", "Gala - Freed from Desire", "Gigi D'Agostino - L'Amour Toujours", "Haddaway - What Is Love", "Robert Miles - Children", "Technotronic - Pump Up the Jam", "U96 - Club Bizarre", "Natte Visstick - Deutsche Techno Bunker", "PSY - Gangnam Style"],
    "funk-narew": ["Bee Gees - Stayin' Alive", "Earth, Wind & Fire - Let's Groove", "Earth, Wind & Fire - September", "Jamiroquai - Cosmic Girl", "Jamiroquai - Virtual Insanity", "Redbone - Come and Get Your Love", "Daft Punk - Get Lucky"],
    "moonwalk": ["Michael Jackson - Bad", "Michael Jackson - Beat It", "Michael Jackson - Billie Jean", "Michael Jackson - Black or White", "Michael Jackson - Don't Stop 'Til You Get Enough", "Michael Jackson - Jam", "Michael Jackson - Off the Wall", "Michael Jackson - P.Y.T. (Pretty Young Thing)", "Michael Jackson - Rock with You", "Michael Jackson - Smooth Criminal", "Michael Jackson - The Way You Make Me Feel", "Michael Jackson - They Don't Care About Us", "Michael Jackson - Thriller", "Michael Jackson - Wanna Be Startin' Somethin'", "Sandaru Sathsara - Billie Jean"],
    "narew-rock": ["@01 Tom Petty - Love Is a Long Road (GTA VI trailer 1)|Tom Petty and the Heartbreakers|Love Is a Long Road", "ACDC - Back in Black", "ACDC - Highway to Hell", "ACDC - Shoot to Thrill", "ACDC - Thunderstruck", "Black Sabbath - Iron Man", "Ramones - Blitzkrieg Bop", "Survivor - Eye of the Tiger", "The White Stripes - Seven Nation Army", "Electric Light Orchestra - Mr. Blue Sky"],
    "costa-fm": ["@02 The Pointer Sisters - Hot Together (GTA VI trailer 2)|The Pointer Sisters|Hot Together", "a-ha - Take On Me", "A Flock of Seagulls - Space Age Love Song", "Bronski Beat - Smalltown Boy", "Limahl - Never Ending Story", "Phil Collins - In the Air Tonight", "The Go-Go's - Vacation"],
    "zlota-godzina": ["@05 Jan Hammer - Crockett's Theme|Jan Hammer|Crockett's Theme", "@06 The Midnight - Sunset|The Midnight|Sunset", "@04 GTA Vice City - Main Theme|Lex Horton|Vice City Theme", "Jean-Michel Jarre - Oxygène, Pt. 4", "Jean-Michel Jarre - Coachella Opening", "Daft Punk - Veridis Quo"],
    "blok": ["2Pac - California Love", "Big Shaq - Man's Not Hot", "Blackway & Black Caviar - What's Up Danger", "De La Soul - The Magic Number", "Kanye West - Flashing Lights", "Kanye West - Good Morning", "Post Malone & Swae Lee - Sunflower"],
    "filharmonia": ["Alan Silvestri - The Avengers", "Hans Zimmer - Cornfield Chase", "Hans Zimmer - No Time for Caution", "Hans Zimmer - Time", "Michael Giacchino - Spider-Man Homecoming Suite", "Michael Giacchino - Theme from Spider-Man (Homecoming)", "Mozart - Eine kleine Nachtmusik"],
    "renifer": ["Ariana Grande - Santa Tell Me", "Band Aid - Do They Know It's Christmas", "Bobby Helms - Jingle Bell Rock", "Boney M. - Mary's Boy Child", "Brenda Lee - Rockin' Around the Christmas Tree", "Burl Ives - A Holly Jolly Christmas", "Chris Rea - Driving Home for Christmas", "Darlene Love - Christmas (Baby Please Come Home)", "Dean Martin - Let It Snow! Let It Snow! Let It Snow!", "Ed Sheeran & Elton John - Merry Christmas", "Elton John - Step into Christmas", "Frank Sinatra - Jingle Bells", "Jackson 5 - Santa Claus Is Comin' to Town", "José Feliciano - Feliz Navidad", "Justin Bieber - Mistletoe", "Kelly Clarkson - Underneath the Tree", "Mariah Carey - All I Want for Christmas Is You", "Michael Bublé - It's Beginning to Look a Lot Like Christmas", "Paul McCartney - Wonderful Christmastime", "Shakin' Stevens - Merry Christmas Everyone", "Slade - Merry Xmas Everybody", "The Ronettes - Sleigh Ride", "Wham! - Last Christmas", "Wizzard - I Wish It Could Be Christmas Everyday"],
    "szanghaj": ["A Si (阿肆) - 热爱105°C的你 (Super Idol)", "Baoshi Gem (宝石Gem) - 野狼Disco (Wild Wolf Disco)", "Chopstick Brothers (筷子兄弟) - 小苹果 (Little Apple)", "Evelyn Lee (李亞軒) - All I Want for Christmas Is You (中文版)", "Pat Chan & Albert Au (陳美玲、區瑞強) - 說不完的故事 (Never Ending Story)", "Samuel Tai (邰正宵) - 祝你聖誕快樂 (Feliz Navidad)", "ToNick - 聖誕歌 (Last Christmas)", "Zhang Shaolin (張少林) - 痴線 (Beat It)"],
    "fala-prl": ["Franek Kimono - Dysk Dżokej", "Franek Kimono - King Bruce Lee Karate Mistrz", "Franek Kimono - Pola Monola + Coca Cola", "Franek Kimono - Tankowanie nocą", "Maryla Rodowicz - Remedium"],
    "gzowo-labs": ["Gzowo Labs - Gzowo Jest Najlepsze", "Gzowo Labs - Moon Mission", "Gzowo Labs - untitledtypebeat"],
}


def slug(text):
    out = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return out[:48] or "track"


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def main():
    os.makedirs(OUT, exist_ok=True)
    result = {}
    used = set()
    count = 0
    for station, entries in STATIONS.items():
        tracks = []
        for entry in entries:
            if entry.startswith("@"):
                name, artist, title = entry[1:].split("|")
                src = os.path.join(EXTRA, name + ".mp3")
                dest_name = slug(artist + "-" + title) + ".mp3"
                dest = os.path.join(OUT, dest_name)
                if os.path.exists(src) and not os.path.exists(dest):
                    subprocess.run(["cp", src, dest], check=True)
            else:
                folder = os.path.join(LIBRARY, entry)
                used.add(entry)
                meta = json.load(open(os.path.join(folder, "meta.json")))
                artist, title = meta["artist"], meta["title"]
                dest_name = slug(artist + "-" + title) + ".mp3"
                if dest_name == "track.mp3":
                    dest_name = "track-%03d.mp3" % count
                dest = os.path.join(OUT, dest_name)
                if not os.path.exists(dest):
                    stems = [os.path.join(folder, s + ".m4a") for s in meta.get("stems", ["vocals", "drums", "bass", "other"])]
                    cmd = ["nice", "-n", "10", "ffmpeg", "-v", "error", "-y"]
                    for s in stems:
                        cmd += ["-i", s]
                    cmd += ["-filter_complex", "amix=inputs=%d:normalize=0,alimiter=limit=0.95" % len(stems), "-ac", "2", "-ar", "44100", "-b:a", "128k", "-threads", "1", dest + ".part.mp3"]
                    subprocess.run(cmd, check=True)
                    os.replace(dest + ".part.mp3", dest)
            if os.path.exists(dest):
                tracks.append({"file": dest_name, "title": title, "artist": artist, "duration": round(duration(dest), 1)})
                count += 1
                print(station, dest_name, flush=True)
        result[station] = tracks
    json.dump(result, open(os.path.join(OUT, "tracks.json"), "w"), ensure_ascii=False, indent=1)
    missing = sorted(set(os.listdir(LIBRARY)) - used - {".DS_Store"})
    print("tracks", count, "unassigned", missing)


if __name__ == "__main__":
    main()
