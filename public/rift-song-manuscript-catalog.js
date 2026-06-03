/**
 * RIFT — Song manuscript discovery catalog (all age soundtrack tracks + lore).
 */
(function initRoyalArmiesSongManuscriptCatalog(global) {
    'use strict';

    /** @type {ReadonlyArray<{trackId:string,title:string,nation:string,body:string}>} */
    const SONG_MANUSCRIPT_ENTRIES = Object.freeze([
        {
            trackId: 'cascading-skies',
            title: 'Cascading Skies',
            nation: 'Aesthene',
            body: `
                <p>Originating from the open-air summit sanctuaries within the nation of Aesthene, this piece was composed by the senior ritual-keepers and local mountain musicians who lived and worked high within the mountain range. During the seasonal alignment of the Vael-Tide, when the northern lights cascade low enough to brush the highest peaks, these composers gathered within the stone sanctuaries to create this atmospheric instrumental movement.</p>
                <p>They intentionally crafted the arrangement to mimic the natural shifting of weather patterns through the clouds, taking advantage of how the mountain winds echo through the acoustic arches of their home. This focus-piece was created out of absolute necessity to allow the sanctuary&apos;s masters to lock their minds into a singular, disciplined state of poise, giving them the mental clarity needed to channel divine magic safely away from the chaotic distractions of the lowlands of their nation.</p>
            `
        },
        {
            trackId: 'kindred',
            title: 'Kindred Memories',
            nation: 'Vaelior',
            body: `
                <p>This raw instrumental piece originated directly from the hearth-fires inside the coastal longhouses within the nation of Vaelior, the permanent settlement where the local clans live alongside the crashing waves and ancestral burial stones. It was performed by an unpolished clan-elder of the Gulf during the Winter-Weep—the first freezing freeze of the year when the coastal residents gather indoors for the dark months.</p>
                <p>Playing entirely solitary without any accompaniment, they wove a long, continuous melody to recount the history of fallen lineages. The arrangement was brought to life to serve as a vital cultural anchor for their people, ensuring the memory of their blood-kin would never fade into the sea, acting as a living historical bridge between the ancestors and the newborn youth of the nation.</p>
            `
        },
        {
            trackId: 'wandering-soul',
            title: 'Wandering Soul',
            nation: 'Aethelgard',
            body: `
                <p>Conceived beside a temporary trail-camp sheltered beneath the towering pine canopies, this track originated from the deep backcountry within the nation of Aethelgard, a brutal territory traversed by the rugged, traveling lore-speakers who call these freezing forests home. Captured during the punishing blizzards of the Great Drift—a hazardous season where straying from the main clan-paths meant certain isolation—a local musician recorded this somber instrumental lament.</p>
                <p>The piece meticulously mimics the exhaustive thud of footsteps pushing through deep snow. This musical monument was written by the traveler to honor the scouts and outcasts who braved the lawless wilderness alone, capturing the exhaustion, profound isolation, and unyielding fortitude required to survive the deadly winter chill of their homeland nation.</p>
            `
        },
        {
            trackId: 'field-of-gods',
            title: 'Field of Gods',
            nation: 'Vaelior',
            body: `
                <p>Originating from the towering, monumental coastal temples within the nation of Vaelior, this grand instrumental piece was crafted by the resident high-priests and sacred musicians who tended the holy altars. Formed during the high ceremonial feast days when the tides reached their absolute peak, the composers utilized the vast, open-air stone architecture to create a slow, majestic, and deeply resonant atmosphere.</p>
                <p>The movement was deliberately structured to mimic the eternal, sweeping scale of the ocean cliffs and the divine presence rolling off the waves. This sacred arrangement was brought to life to instill a sense of absolute humility, awe, and spiritual grounding in the coastal clans as they gathered to pay tribute to the ancient entities of their nation.</p>
            `
        },
        {
            trackId: 'arcane-soul',
            title: 'Arcane Soul',
            nation: 'Aesthene',
            body: `
                <p>This hypnotic instrumental arrangement originated deep within the secure, central library vaults within the nation of Aesthene, where the resident mages and arcane scholars lived in total isolation. Composed during the midnight hours of the eclipse cycle—a period when raw magical currents are notoriously unstable—the enclave&apos;s master-theorists constructed a highly complex, spellbinding, and meticulously repetitive rhythmic structure.</p>
                <p>The track was intentionally layered to embody the rhythmic precision and focused geometry of high-tier spellcraft. It was designed out of critical necessity to act as an auditory anchor, keeping the minds of researchers tightly focused and deeply relaxed during long, dangerous sessions of transcribing volatile ancient scripts.</p>
            `
        },
        {
            trackId: 'a-gracious-host',
            title: 'A Gracious Host',
            nation: 'Khaerant',
            body: `
                <p>Born within the inner, iron-fortified palace keep within the nation of Khaerant, this rigid instrumental piece was commissioned by the central high-command and the formal court administrators of the autocracy. Executed with flawless precision during the strict diplomatic banquets held for foreign delegates, the palace&apos;s professional court musicians delivered a highly formulaic, tense, and chillingly pristine arrangement.</p>
                <p>The movement was calculated to sound high-class yet completely unyielding, capturing the cold, mechanical efficiency of an empire built on absolute law. It was crafted as a deliberate psychological tool to project total structural dominance and imperial poise, reminding visitors that even the nation&apos;s entertainment was bound by strict, unbreakable discipline.</p>
            `
        },
        {
            trackId: 'the-battles-of-old',
            title: 'The Battles of Old',
            nation: 'Aethelgard',
            body: `
                <p>This somber instrumental track originated within the central military memorials built into the freezing frontiers within the nation of Aethelgard, where veteran scouts and regional defense-leaders made their permanent garrisons. Crafted during the annual Day of Remembrance—a solemn event marking the first snowfall over historic execution grounds—the local lore-masters composed a deeply melancholic, weeping melody.</p>
                <p>The arrangement was intentionally paced to mirror the exhaustive, heavy heartbeat of an empire carrying centuries of warfare on its back. This piece was written to serve as an unpolished, eternal monument to the anonymous frontier forces, capturing the heavy, unvarnished tragedy of survival in the northern wilderness.</p>
            `
        },
        {
            trackId: 'bellows-canyon',
            title: "Bellow's Canyon",
            nation: 'Aethelgard',
            body: `
                <p>Originating directly from the narrow, high-altitude outpost fortifications within the nation of Aethelgard, this frantic instrumental track was composed by frontier sentries and combat musicians stationed along the border passes. Conceived in the chaotic aftermath of a massive mountain skirmish, the creators forged a high-velocity, aggressive, and rough movement that captured the absolute panic of close-quarters combat.</p>
                <p>The tempo was deliberately structured to mimic the uneven, high-stakes adrenaline of a desperate ambush in tight geography. It was written to serve as a tactical cadence, preserving the raw intensity of the battle and fueling the aggressive, defensive fervor of the border guards protecting the nation&apos;s high passes.</p>
            `
        },
        {
            trackId: 'aidoriian-memories',
            title: 'Aidoriian Memories',
            nation: 'Vaelior',
            body: `
                <p>This raw oral history originated directly from the remote coastal fishing settlements within the nation of Vaelior, where the local seafaring families lived and maintained their ancient oral traditions. It was performed by a solitary, unpolished clan-woman of the gulf during the freezing seasonal migration, when the communities gathered around indoor fires to escape the coastal storms.</p>
                <p>Singing entirely alone with an aggressive, biting accent and hard, rolling consonants, her voice carried a natural, imperfect strain through long, sweeping narrative lines. This ballad was brought to life to preserve the unbroken lineages and oral records of the maritime clans, serving as a gritty, un-amplified monument to ensure the history of the nation&apos;s coastal families would never be erased.</p>
            `
        },
        {
            trackId: 'a-warriors-pride',
            title: "A Warrior's Pride",
            nation: 'Khaerant',
            body: `
                <p>This brutal military march originated from the heavy iron foundries and training grounds within the nation of Khaerant, where the elite forces of the autocracy lived and labored. Performed by a disciplined battalion of the imperial guard during their grueling multi-mile endurance marches through the industrial heartlands, the group delivered a harsh, unpolished unison chant.</p>
                <p>Dropping their voices into a deep, guttural register with a heavy, rolling northern accent, the men bit down hard on every syllable without any complex studio harmonies or beautiful chords. This track was created to serve as a rigid psychological anchor, driving physical compliance and reinforcing absolute obedience to the nation&apos;s harsh imperial codes.</p>
            `
        },
        {
            trackId: 'drunken-thrunesian',
            title: 'Drunken Thrunesian',
            nation: 'Thruun',
            body: `
                <p>Originating from the rowdy, lawless public squares and crowded local halls within the nation of Thruun, this chaotic vocal piece was brought to life by the local laborers and agricultural workers who gathered to celebrate the end of the seasonal harvest. Performed by a boisterous, unpolished male crowd during the height of the chaotic autumn street festivals, the singers delivered a slurred, loud, and heavily rhythmic chant.</p>
                <p>The performance was defined by random shouts, stomping feet, and out-of-time clapping that moved with a driving, un-orchestrated momentum. This song was created as a pure expression of communal release, capturing the rowdy, free-spirited, and lawless heartbeat of the nation&apos;s working people.</p>
            `
        },
        {
            trackId: 'rivers-of-blood',
            title: 'Rivers of Blood',
            nation: 'Unknown',
            body: `
                <p>A recovered song manuscript from the Age archives. Its provenance has not yet been matched to a single nation or composer—only the melody survives, preserved for commanders who uncover it on campaign.</p>
            `
        },
        {
            trackId: 'dravic-fortitude',
            title: 'Dravic Fortitude',
            nation: 'Dravic',
            body: `
                <p>A recovered song manuscript associated with the Dravic territories. Full chronicle text has not yet been transcribed; the arrangement is catalogued here until field scholars confirm its origin.</p>
            `
        },
        {
            trackId: 'awakened',
            title: 'Awakened',
            nation: 'Unknown',
            body: `
                <p>A recovered song manuscript held in the Lost Manuscripts vault. Its binding is intact but the opening pages are missing—only the performance notation remains for those who discover it in the Age.</p>
            `
        }
    ]);

    const BY_TRACK_ID = SONG_MANUSCRIPT_ENTRIES.reduce((map, entry) => {
        map[entry.trackId] = entry;
        return map;
    }, Object.create(null));

    const ALL_TRACK_IDS = SONG_MANUSCRIPT_ENTRIES.map((entry) => entry.trackId);

    global.RoyalArmiesSongManuscriptCatalog = Object.freeze({
        entries: SONG_MANUSCRIPT_ENTRIES,
        byTrackId: BY_TRACK_ID,
        allTrackIds: ALL_TRACK_IDS,
        getEntry(trackId) {
            return BY_TRACK_ID[String(trackId || '').trim().toLowerCase()] || null;
        }
    });
})(window);
