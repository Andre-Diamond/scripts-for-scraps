// Types for date heading parsing
export interface DateHeading {
    index: number;
    date: string;
}

// Helper function to find the closest date heading before a given position
export function findClosestDate(position: number, dateHeadings: DateHeading[]): string | null {
    let closestDate = null;
    let closestDistance = Infinity;

    for (const dateHeading of dateHeadings) {
        // Only consider date headings that come before the current position
        if (dateHeading.index < position && (position - dateHeading.index) < closestDistance) {
            closestDistance = position - dateHeading.index;
            closestDate = dateHeading.date;
        }
    }

    return closestDate;
}

// Extract date headings from markdown content
export function extractDateHeadings(markdown: string): DateHeading[] {
    const dateHeadings: DateHeading[] = [];
    const datePattern = /## ([A-Za-z]+) (\d+)(?:st|nd|rd|th) ([A-Za-z]+) (\d{4})/g;
    let dateMatch;

    while ((dateMatch = datePattern.exec(markdown)) !== null) {
        const day = dateMatch[2].padStart(2, '0');
        const month = dateMatch[3];
        const year = dateMatch[4];

        // Convert month name to number
        const monthMap: Record<string, string> = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        const monthNum = monthMap[month];

        // Format as YYYY-MM-DD
        const formattedDate = `${year}-${monthNum}-${day}`;

        dateHeadings.push({
            index: dateMatch.index,
            date: formattedDate
        });
    }

    return dateHeadings;
} 