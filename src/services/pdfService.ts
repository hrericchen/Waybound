import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

const PRIMARY = '#5B67F5';
const PRIMARY_DARK = '#3D47C7';
const ACCENT = '#FF6B9D';
const SUCCESS = '#2ED47A';
const TEXT = '#1A1A2E';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const CARD_BG = '#F9FAFB';
const WHITE = '#FFFFFF';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function generateDayTimeline(activities: any[]): string {
  if (!activities || activities.length === 0) {
    return `<div class="empty-state">No activities yet. Add activities to your itinerary to see them here.</div>`;
  }

  // Group by day
  const grouped: Record<number, any[]> = {};
  activities.forEach((a) => {
    const day = a.day || 1;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(a);
  });

  const sortedDays = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return sortedDays
    .map(
      (dayNum) => `
    <div class="day-section">
      <div class="day-header">
        <div class="day-badge">Day ${dayNum}</div>
        <div class="day-line"></div>
      </div>
      <div class="day-activities">
        ${grouped[dayNum]
          .map(
            (activity, idx) => `
          <div class="activity-item" style="${idx > 0 ? 'margin-top:12px;' : ''}">
            <div class="activity-marker"></div>
            <div class="activity-card">
              <div class="activity-title-row">
                ${activity.emoji ? `<span class="activity-emoji">${escapeHtml(activity.emoji)}</span>` : ''}
                <span class="activity-title">${escapeHtml(activity.title || 'Untitled Activity')}</span>
                ${activity.completed ? '<span class="completed-badge">✓ Done</span>' : ''}
              </div>
              ${activity.notes ? `<p class="activity-notes">${escapeHtml(activity.notes)}</p>` : ''}
              ${activity.links && activity.links.length > 0 ? `
                <div class="activity-links">
                  ${activity.links
                    .map(
                      (link: any) =>
                        `<a class="link-item" href="${escapeHtml(link.url)}">🔗 ${escapeHtml(link.title)}</a>`
                    )
                    .join('')}
                </div>
              ` : ''}
              ${activity.photos && activity.photos.length > 0 ? `
                <div class="photo-grid">
                  ${activity.photos
                    .slice(0, 4)
                    .map(
                      (photo: any) =>
                        `<div class="photo-cell"><img src="${escapeHtml(photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri)}" /></div>`
                    )
                    .join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
    )
    .join('');
}

function generateOfficialDays(days: any[]): string {
  if (!days || days.length === 0) {
    return `<div class="empty-state">Timeline coming soon for this trip.</div>`;
  }

  return days
    .map(
      (d, i) => `
    <div class="day-section">
      <div class="day-header">
        <div class="day-badge">Day ${d.day || i + 1}</div>
        <div class="day-line"></div>
      </div>
      <div class="activity-item">
        <div class="activity-marker"></div>
        <div class="activity-card">
          <span class="activity-title">${escapeHtml(d.title || `Day ${d.day || i + 1}`)}</span>
          ${d.activities ? `<p class="activity-notes">${escapeHtml(Array.isArray(d.activities) ? d.activities.join(' · ') : d.activities)}</p>` : ''}
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

export async function exportItineraryPDF(itinerary: any) {
  try {
    const title = escapeHtml(itinerary.title || 'My Trip');
    const destinations = itinerary.destinations?.join(', ') || itinerary.country || 'Adventure Awaits';
    const season = itinerary.season || 'Any Season';
    const budget = itinerary.budget || 'Varies';
    const dayCount = itinerary.activities?.length || itinerary.days?.length || 1;
    const spotCount = itinerary.destinations?.length || itinerary.highlights?.length || 0;
    const description = itinerary.description || '';
    const highlights = itinerary.highlights || [];
    const isItinerary = !!itinerary.activities;

    const coverImageSrc = itinerary.coverImage || itinerary.image || '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: ${TEXT};
      background: ${WHITE};
      line-height: 1.6;
    }
    .cover {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      ${coverImageSrc ? 'color: white;' : `background: linear-gradient(135deg, ${PRIMARY}, ${ACCENT}); color: white;`}
    }
    .cover-bg {
      position: absolute; inset: 0; object-fit: cover; width: 100%; height: 100%; z-index: 0;
    }
    .cover-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(26,26,46,0.3) 0%, rgba(26,26,46,0.85) 100%);
      z-index: 1;
    }
    .cover-content {
      position: relative; z-index: 2;
      display: flex; flex-direction: column; justify-content: flex-end;
      flex: 1; padding: 60px 40px;
    }
    .cover-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.2); backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 50px; padding: 8px 18px;
      font-size: 13px; font-weight: 700; letter-spacing: 1px;
      margin-bottom: 24px; align-self: flex-start;
    }
    .cover-title {
      font-size: 42px; font-weight: 900; letter-spacing: -1px;
      line-height: 1.1; margin-bottom: 12px;
    }
    .cover-subtitle {
      font-size: 18px; opacity: 0.9; font-weight: 500;
    }
    .cover-meta {
      display: flex; gap: 24px; margin-top: 32px; flex-wrap: wrap;
    }
    .cover-meta-item {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.15); backdrop-filter: blur(8px);
      border-radius: 12px; padding: 12px 20px;
    }
    .cover-meta-icon { font-size: 20px; }
    .cover-meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
    .cover-meta-value { font-size: 16px; font-weight: 800; }
    .content { padding: 50px 40px; max-width: 800px; margin: 0 auto; }
    .section-title {
      font-size: 24px; font-weight: 800; letter-spacing: -0.5px;
      margin-bottom: 8px; color: ${TEXT};
    }
    .section-divider {
      width: 48px; height: 4px; border-radius: 2px;
      background: linear-gradient(90deg, ${PRIMARY}, ${ACCENT});
      margin-bottom: 32px;
    }
    .info-cards {
      display: flex; gap: 16px; margin-bottom: 40px; flex-wrap: wrap;
    }
    .info-card {
      flex: 1; min-width: 140px; background: ${CARD_BG};
      border-radius: 16px; padding: 20px; border: 1px solid ${BORDER};
    }
    .info-card-icon { font-size: 24px; margin-bottom: 8px; }
    .info-card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${MUTED}; margin-bottom: 4px; }
    .info-card-value { font-size: 18px; font-weight: 800; color: ${TEXT}; }
    .day-section { margin-bottom: 32px; }
    .day-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .day-badge {
      background: linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK});
      color: white; font-size: 13px; font-weight: 800; letter-spacing: 0.5px;
      border-radius: 50px; padding: 6px 18px; white-space: nowrap;
    }
    .day-line { flex: 1; height: 1px; background: ${BORDER}; }
    .day-activities { padding-left: 0; }
    .activity-item { display: flex; gap: 16px; align-items: flex-start; }
    .activity-marker {
      width: 12px; height: 12px; border-radius: 50%;
      background: linear-gradient(135deg, ${PRIMARY}, ${ACCENT});
      margin-top: 18px; flex-shrink: 0;
    }
    .activity-card {
      flex: 1; background: ${CARD_BG}; border: 1px solid ${BORDER};
      border-radius: 14px; padding: 18px;
    }
    .activity-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .activity-emoji { font-size: 20px; }
    .activity-title { font-size: 17px; font-weight: 700; }
    .completed-badge {
      background: ${SUCCESS}20; color: ${SUCCESS}; font-size: 10px; font-weight: 800;
      border-radius: 50px; padding: 3px 10px; letter-spacing: 0.5px;
    }
    .activity-notes { margin-top: 8px; font-size: 14px; color: ${MUTED}; line-height: 1.7; }
    .activity-links { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .link-item {
      background: ${PRIMARY}10; color: ${PRIMARY}; font-size: 12px; font-weight: 600;
      padding: 6px 12px; border-radius: 50px; text-decoration: none;
    }
    .photo-grid { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .photo-cell {
      width: calc(50% - 4px); aspect-ratio: 4/3; overflow: hidden; border-radius: 10px;
      background: ${BORDER};
    }
    .photo-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .highlights-section { margin-bottom: 40px; }
    .highlight-item {
      display: flex; align-items: center; gap: 12px;
      background: ${CARD_BG}; border: 1px solid ${BORDER};
      border-radius: 12px; padding: 14px 18px; margin-bottom: 10px;
    }
    .highlight-bullet {
      width: 10px; height: 10px; border-radius: 50%;
      background: linear-gradient(135deg, ${PRIMARY}, ${ACCENT});
      flex-shrink: 0;
    }
    .highlight-text { font-size: 14px; font-weight: 600; color: ${TEXT}; }
    .description-text { font-size: 15px; color: ${MUTED}; line-height: 1.8; margin-bottom: 40px; }
    .empty-state { text-align: center; color: ${MUTED}; font-size: 14px; padding: 40px 20px; font-style: italic; }
    .footer {
      text-align: center; padding: 30px 40px 50px;
      font-size: 12px; color: ${MUTED}; border-top: 1px solid ${BORDER};
    }
    .footer-brand { font-weight: 800; color: ${PRIMARY}; }
    @page { margin: 0; }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover">
    ${coverImageSrc ? `<img src="${escapeHtml(coverImageSrc)}" class="cover-bg" />` : ''}
    <div class="cover-overlay"></div>
    <div class="cover-content">
      <div class="cover-badge">🌍 TRAVEL ITINERARY</div>
      <h1 class="cover-title">${title}</h1>
      <p class="cover-subtitle">${escapeHtml(destinations)}</p>
      <div class="cover-meta">
        <div class="cover-meta-item">
          <div>
            <div class="cover-meta-label">Duration</div>
            <div class="cover-meta-value">${dayCount} Days</div>
          </div>
        </div>
        <div class="cover-meta-item">
          <div>
            <div class="cover-meta-label">Stops</div>
            <div class="cover-meta-value">${spotCount} Places</div>
          </div>
        </div>
        ${budget && budget !== 'Varies' ? `
        <div class="cover-meta-item">
          <div>
            <div class="cover-meta-label">Budget</div>
            <div class="cover-meta-value">$${escapeHtml(String(budget))}</div>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="content">
    <h2 class="section-title">Trip Overview</h2>
    <div class="section-divider"></div>

    <div class="info-cards">
      <div class="info-card">
        <div class="info-card-icon">📅</div>
        <div class="info-card-label">Season</div>
        <div class="info-card-value">${escapeHtml(season)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📍</div>
        <div class="info-card-label">Destinations</div>
        <div class="info-card-value">${spotCount} Stops</div>
      </div>
      <div class="info-card">
        <div class="info-card-icon">📋</div>
        <div class="info-card-label">Activities</div>
        <div class="info-card-value">${isItinerary ? (itinerary.activities?.length || 0) : (itinerary.highlights?.length || 0)} Total</div>
      </div>
    </div>

    ${description ? `<p class="description-text">${escapeHtml(description)}</p>` : ''}

    ${highlights.length > 0 ? `
    <h2 class="section-title">Highlights</h2>
    <div class="section-divider"></div>
    <div class="highlights-section">
      ${highlights.map((h: string) => `
        <div class="highlight-item">
          <div class="highlight-bullet"></div>
          <span class="highlight-text">${escapeHtml(h)}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <h2 class="section-title">${isItinerary ? 'Day-by-Day Itinerary' : 'Trip Timeline'}</h2>
    <div class="section-divider"></div>

    ${isItinerary ? generateDayTimeline(itinerary.activities) : generateOfficialDays(itinerary.days)}
  </div>

  <div class="footer">
    Generated by <span class="footer-brand">Waybound</span> · Your Travel Planning Companion
  </div>
</body>
</html>`;

    const { uri } = await Print.printToFileAsync({
      html,
      width: 612,
      height: 792,
      base64: false,
    });

    const filename = `${itinerary.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Waybound_Itinerary'}.pdf`;

    if (Platform.OS === 'web') {
      window.open(uri, '_blank');
    } else {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: filename,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Saved', `Your itinerary PDF has been saved. You can find it at:\n${uri}`);
      }
    }
  } catch (error) {
    console.error('PDF export failed:', error);
    Alert.alert('Export Failed', 'Could not generate the PDF. Please try again.');
  }
}