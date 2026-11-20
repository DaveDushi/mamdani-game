// Called only at a free course slot. Teaching, ice and paired rows own their
// reserved space before the course asks for another encounter.
export function createCivicSchedule(random) {
    let carriageAt = 2700;
    let protestAt = 4150;
    return function select(distance) {
        if (distance < Math.min(carriageAt, protestAt)) return null;
        if (carriageAt <= protestAt) {
            carriageAt = distance + 3600 + Math.floor(random() * 4600);
            protestAt = Math.max(protestAt, distance + 1000);
            return 'horse-carriage';
        }
        protestAt = distance + 3900 + Math.floor(random() * 4800);
        carriageAt = Math.max(carriageAt, distance + 1000);
        return 'protest-line';
    };
}
