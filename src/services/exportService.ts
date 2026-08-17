import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';

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

function escapeCsv(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// ================================
//          PDF EXPORT
// ================================

function generateDayTimeline(activities: any[]): string {
  if (!activities || activities.length === 0) {
    return `<div class="empty-state">No activities yet.</div>`;
  }
  const grouped: Record<number, any[]> = {};
  activities.forEach((a) => {
    const day = a.day || 1;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(a);
  });
  const sortedDays = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  return sortedDays.map((dayNum) => `
    <div class="day-section">
      <div class="day-header"><div class="day-badge">Day ${dayNum}</div><div class="day-line"></div></div>
      <div class="day-activities">
        ${grouped[dayNum].map((activity, idx) => `
          <div class="activity-item" style="${idx > 0 ? 'margin-top:12px;' : ''}">
            <div class="activity-marker"></div>
            <div class="activity-card">
              <div class="activity-title-row">
                ${activity.emoji ? `<span class="activity-emoji">${escapeHtml(activity.emoji)}</span>` : ''}
                <span class="activity-title">${escapeHtml(activity.title || 'Untitled')}</span>
                ${activity.completed ? '<span class="completed-badge">✓</span>' : ''}
              </div>
              ${activity.notes ? `<p class="activity-notes">${escapeHtml(activity.notes)}</p>` : ''}
              ${activity.links?.length ? `<div class="activity-links">${activity.links.map((l: any) => `<a class="link-item" href="${escapeHtml(l.url)}">🔗 ${escapeHtml(l.title)}</a>`).join('')}</div>` : ''}
              ${activity.photos?.length ? `<div class="photo-grid">${activity.photos.slice(0,4).map((p: any) => `<div class="photo-cell"><img src="${escapeHtml(p.base64 ? `data:image/jpeg;base64,${p.base64}` : p.uri)}" /></div>`).join('')}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function generatePDFHtml(itinerary: any): string {
  const title = escapeHtml(itinerary.title || 'My Trip');
  const destinations = itinerary.destinations?.join(', ') || itinerary.country || '';
  const season = itinerary.season || 'Any Season';
  const budget = itinerary.budget || '';
  const dayCount = itinerary.activities?.length || itinerary.days?.length || 1;
  const spotCount = itinerary.destinations?.length || itinerary.highlights?.length || 0;
  const isItinerary = !!itinerary.activities;
  const coverImageSrc = itinerary.coverImage || '';
  const highlights = itinerary.highlights || [];
  const description = itinerary.description || '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; color: ${TEXT}; background: ${WHITE}; line-height: 1.6; }
    .cover { position: relative; min-height: 100vh; display: flex; flex-direction: column; ${coverImageSrc ? 'color: white;' : `background: linear-gradient(135deg, ${PRIMARY}, ${ACCENT}); color: white;`} }
    .cover-bg { position: absolute; inset: 0; object-fit: cover; width: 100%; height: 100%; z-index: 0; }
    .cover-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(26,26,46,0.3) 0%, rgba(26,26,46,0.85) 100%); z-index: 1; }
    .cover-content { position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: flex-end; flex: 1; padding: 60px 40px; }
    .cover-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); border-radius: 50px; padding: 8px 18px; font-size: 13px; font-weight: 700; margin-bottom: 24px; align-self: flex-start; }
    .cover-title { font-size: 42px; font-weight: 900; margin-bottom: 12px; }
    .cover-subtitle { font-size: 18px; opacity: 0.9; }
    .cover-meta { display: flex; gap: 24px; margin-top: 32px; flex-wrap: wrap; }
    .cover-meta-item { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px 20px; }
    .cover-meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; opacity: 0.8; }
    .cover-meta-value { font-size: 16px; font-weight: 800; }
    .content { padding: 50px 40px; max-width: 800px; margin: 0 auto; }
    .section-title { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    .section-divider { width: 48px; height: 4px; border-radius: 2px; background: linear-gradient(90deg, ${PRIMARY}, ${ACCENT}); margin-bottom: 32px; }
    .info-cards { display: flex; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }
    .info-card { flex: 1; min-width: 140px; background: ${CARD_BG}; border-radius: 16px; padding: 20px; border: 1px solid ${BORDER}; }
    .info-card-icon { font-size: 24px; margin-bottom: 8px; }
    .info-card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${MUTED}; margin-bottom: 4px; }
    .info-card-value { font-size: 18px; font-weight: 800; }
    .day-section { margin-bottom: 32px; }
    .day-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .day-badge { background: linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK}); color: white; font-size: 13px; font-weight: 800; border-radius: 50px; padding: 6px 18px; white-space: nowrap; }
    .day-line { flex: 1; height: 1px; background: ${BORDER}; }
    .activity-item { display: flex; gap: 16px; align-items: flex-start; }
    .activity-marker { width: 12px; height: 12px; border-radius: 50%; background: linear-gradient(135deg, ${PRIMARY}, ${ACCENT}); margin-top: 18px; flex-shrink: 0; }
    .activity-card { flex: 1; background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 14px; padding: 18px; }
    .activity-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .activity-emoji { font-size: 20px; }
    .activity-title { font-size: 17px; font-weight: 700; }
    .completed-badge { background: ${SUCCESS}20; color: ${SUCCESS}; font-size: 10px; font-weight: 800; border-radius: 50px; padding: 3px 10px; }
    .activity-notes { margin-top: 8px; font-size: 14px; color: ${MUTED}; }
    .activity-links { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .link-item { background: ${PRIMARY}10; color: ${PRIMARY}; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 50px; text-decoration: none; }
    .photo-grid { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .photo-cell { width: calc(50% - 4px); aspect-ratio: 4/3; overflow: hidden; border-radius: 10px; background: ${BORDER}; }
    .photo-cell img { width: 100%; height: 100%; object-fit: cover; }
    .empty-state { text-align: center; color: ${MUTED}; font-size: 14px; padding: 40px; font-style: italic; }
    .footer { text-align: center; padding: 30px 40px 50px; font-size: 12px; color: ${MUTED}; border-top: 1px solid ${BORDER}; }
    .footer-brand { font-weight: 800; color: ${PRIMARY}; }
    @page { margin: 0; }
  </style></head><body>
  <div class="cover">
    ${coverImageSrc ? `<img src="${escapeHtml(coverImageSrc)}" class="cover-bg" />` : ''}
    <div class="cover-overlay"></div>
    <div class="cover-content">
      <div class="cover-badge">🌍 TRAVEL ITINERARY</div>
      <h1 class="cover-title">${title}</h1>
      <p class="cover-subtitle">${escapeHtml(destinations)}</p>
      <div class="cover-meta">
        <div class="cover-meta-item"><div><div class="cover-meta-label">Duration</div><div class="cover-meta-value">${dayCount} Days</div></div></div>
        <div class="cover-meta-item"><div><div class="cover-meta-label">Stops</div><div class="cover-meta-value">${spotCount} Places</div></div></div>
        ${budget ? `<div class="cover-meta-item"><div><div class="cover-meta-label">Budget</div><div class="cover-meta-value">$${escapeHtml(String(budget))}</div></div></div>` : ''}
      </div>
    </div>
  </div>
  <div class="content">
    <h2 class="section-title">Trip Overview</h2><div class="section-divider"></div>
    <div class="info-cards">
      <div class="info-card"><div class="info-card-icon">📅</div><div class="info-card-label">Season</div><div class="info-card-value">${escapeHtml(season)}</div></div>
      <div class="info-card"><div class="info-card-icon">📍</div><div class="info-card-label">Destinations</div><div class="info-card-value">${spotCount} Stops</div></div>
      <div class="info-card"><div class="info-card-icon">📋</div><div class="info-card-label">Activities</div><div class="info-card-value">${isItinerary ? (itinerary.activities?.length || 0) : (highlights.length || 0)} Total</div></div>
    </div>
    ${description ? `<p style="font-size:15px;color:${MUTED};margin-bottom:40px;">${escapeHtml(description)}</p>` : ''}
    ${highlights.length > 0 ? `<h2 class="section-title">Highlights</h2><div class="section-divider"></div>${highlights.map((h: string) => `<div style="display:flex;align-items:center;gap:12px;background:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;padding:14px;margin-bottom:10px;"><div style="width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,${PRIMARY},${ACCENT});"></div><span style="font-weight:600;">${escapeHtml(h)}</span></div>`).join('')}` : ''}
    <h2 class="section-title">Day-by-Day Itinerary</h2><div class="section-divider"></div>
    ${isItinerary ? generateDayTimeline(itinerary.activities) : '<div class="empty-state">No activities yet.</div>'}
  </div>
  <div class="footer">Generated by <span class="footer-brand">Waybound</span></div>
</body></html>`;
}

export async function exportPDF(itinerary: any): Promise<boolean> {
  try {
    const html = generatePDFHtml(itinerary);
    const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, base64: false });
    const filename = `${(itinerary.title || 'Waybound_Itinerary').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    if (Platform.OS === 'web') {
      window.open(uri, '_blank');
      return true;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
      return true;
    }
    Alert.alert('PDF Saved', `Saved to: ${uri}`);
    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    Alert.alert('Export Failed', 'Could not generate PDF.');
    return false;
  }
}

// ================================
//          ICS EXPORT
// ================================

function generateICS(itinerary: any): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `waybound-${itinerary.id}@waybound.app`;
  let ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Waybound//Itinerary//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:${itinerary.title || 'My Trip'}\r\n`;

  const activities = itinerary.activities || [];
  const baseDate = new Date();
  baseDate.setHours(8, 0, 0, 0);

  activities.forEach((activity: any, index: number) => {
    const dayOffset = (activity.day || 1) - 1;
    const startDate = new Date(baseDate);
    startDate.setDate(baseDate.getDate() + dayOffset + Math.floor(index / 5));
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    const dtStart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0];
    const dtEnd = endDate.toISOString().replace(/[-:]/g, '').split('.')[0];
    const summary = `${activity.emoji || ''} ${activity.title || 'Activity'}`.trim();
    const location = itinerary.destinations?.[0] || '';
    const description = activity.notes || '';

    ics += `BEGIN:VEVENT\r\n`;
    ics += `UID:${uid}-${index}\r\n`;
    ics += `DTSTART:${dtStart}\r\n`;
    ics += `DTEND:${dtEnd}\r\n`;
    ics += `SUMMARY:${summary}\r\n`;
    if (location) ics += `LOCATION:${location}\r\n`;
    if (description) ics += `DESCRIPTION:${description.replace(/\r?\n/g, '\\n')}\r\n`;
    ics += `END:VEVENT\r\n`;
  });

  ics += `END:VCALENDAR\r\n`;
  return ics;
}

export async function exportICS(itinerary: any): Promise<boolean> {
  try {
    const icsContent = generateICS(itinerary);
    const filename = `${(itinerary.title || 'waybound_trip').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    // Use Print to save ICS as a file, then share
    const { uri } = await Print.printToFileAsync({ html: `<pre>${icsContent.replace(/\r\n/g, '\n')}</pre>`, width: 612, height: 792, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'text/calendar', dialogTitle: filename } as any);
      return true;
    }
    Alert.alert('ICS Saved', `Calendar file ready`);
    return true;
  } catch (error) {
    console.error('ICS export failed:', error);
    Alert.alert('Export Failed', 'Could not generate ICS file.');
    return false;
  }
}

// ================================
//          CSV EXPORT
// ================================

function generateCSV(itinerary: any): string {
  let csv = 'Day,Activity Title,Completed,Notes,Links\r\n';
  const activities = itinerary.activities || itinerary.days || [];
  activities.forEach((activity: any) => {
    const day = activity.day || 1;
    const title = activity.title || 'Activity';
    const completed = activity.completed ? 'Yes' : 'No';
    const notes = activity.notes || '';
    const links = (activity.links || []).map((l: any) => l.url || l.title || '').join(' | ');
    csv += `${day},${escapeCsv(title)},${completed},${escapeCsv(notes)},${escapeCsv(links)}\r\n`;
  });
  csv += `\r\nTrip: ${itinerary.title || 'My Trip'}\r\n`;
  csv += `Destinations: ${escapeCsv((itinerary.destinations || []).join(', '))}\r\n`;
  csv += `Season: ${itinerary.season || 'N/A'}\r\n`;
  csv += `Budget: ${itinerary.budget || 'N/A'}\r\n`;
  return csv;
}

export async function exportCSV(itinerary: any): Promise<boolean> {
  try {
    const csvContent = generateCSV(itinerary);
    const filename = `${(itinerary.title || 'waybound_trip').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    // Use Print to save CSV as a file, then share
    const { uri } = await Print.printToFileAsync({ html: `<pre>${csvContent.replace(/\r\n/g, '\n')}</pre>`, width: 612, height: 792, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: filename });
      return true;
    }
    Alert.alert('CSV Saved', `Spreadsheet file ready`);
    return true;
  } catch (error) {
    console.error('CSV export failed:', error);
    Alert.alert('Export Failed', 'Could not generate CSV file.');
    return false;
  }
}

// ================================
//       SHAREABLE LINK
// ================================

export async function exportShareableLink(itinerary: any): Promise<boolean> {
  try {
    const title = itinerary.title || 'My Trip';
    const destinations = (itinerary.destinations || []).join(', ') || 'Unknown';
    const dayCount = itinerary.activities?.length || 1;
    const text = `🌍 ${title}\n📍 ${destinations}\n📅 ${dayCount} day trip\n\nPlanned with Waybound - Your Travel Companion`;
    // Use React Native's Share API (message-based) so we don't need a local
    // file — expo-sharing's shareAsync only accepts file:// URLs.
    await Share.share({
      message: text,
      title: 'Share Trip',
    });
    return true;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

// ================================
//       PNG SHAREABLE CARD
// ================================

function generateCardHTML(itinerary: any): string {
  const title = escapeHtml(itinerary.title || 'My Trip');
  const destinations = escapeHtml((itinerary.destinations || []).join(' · ') || 'Unknown');
  const dayCount = itinerary.activities?.length || 1;
  const activityCount = itinerary.activities?.length || 0;
  const coverImageSrc = itinerary.coverImage || '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #F3F4F6; }
    .card { width: 400px; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); background: white; }
    .card-image { width: 100%; height: 200px; ${coverImageSrc ? `background: url(${escapeHtml(coverImageSrc)}) center/cover;` : `background: linear-gradient(135deg, ${PRIMARY}, ${ACCENT});`} position: relative; }
    .card-image-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(26,26,46,0.7) 100%); }
    .card-image-badge { position: absolute; top: 16px; left: 16px; background: rgba(255,255,255,0.9); border-radius: 50px; padding: 6px 14px; font-size: 12px; font-weight: 800; color: ${PRIMARY}; }
    .card-body { padding: 24px; }
    .card-title { font-size: 24px; font-weight: 900; color: ${TEXT}; margin-bottom: 8px; }
    .card-dest { font-size: 14px; color: ${MUTED}; margin-bottom: 16px; }
    .card-stats { display: flex; gap: 20px; margin-bottom: 16px; }
    .card-stat { display: flex; align-items: center; gap: 6px; }
    .card-stat-icon { font-size: 18px; }
    .card-stat-text { font-size: 13px; font-weight: 700; color: ${TEXT}; }
    .card-tagline { font-size: 12px; color: ${MUTED}; text-align: center; padding-top: 16px; border-top: 1px solid ${BORDER}; }
    .card-footer { text-align: center; padding: 16px 24px; background: ${CARD_BG}; }
    .card-footer-text { font-size: 11px; color: ${MUTED}; }
    .card-footer-brand { font-weight: 800; color: ${PRIMARY}; }
  </style></head><body>
  <div class="card">
    <div class="card-image"><div class="card-image-overlay"></div><div class="card-image-badge">✈️ WAYBOUND</div></div>
    <div class="card-body">
      <h2 class="card-title">${title}</h2>
      <p class="card-dest">${destinations}</p>
      <div class="card-stats">
        <div class="card-stat"><span class="card-stat-icon">📅</span><span class="card-stat-text">${dayCount} Days</span></div>
        <div class="card-stat"><span class="card-stat-icon">📍</span><span class="card-stat-text">${activityCount} Activities</span></div>
      </div>
    </div>
    <div class="card-footer"><span class="card-footer-text">Planned with <span class="card-footer-brand">Waybound</span> · Travel Planning Made Easy</span></div>
  </div>
</body></html>`;
}

export async function exportPNGCard(itinerary: any): Promise<boolean> {
  try {
    const html = generateCardHTML(itinerary);
    const { uri } = await Print.printToFileAsync({ html, width: 400, height: 500, base64: false });
    const filename = `${(itinerary.title || 'waybound_trip').replace(/[^a-zA-Z0-9]/g, '_')}_card.pdf`;
    // Note: PNG export isn't directly supported, so we export as a card-style PDF
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename });
      return true;
    }
    Alert.alert('Card Saved', `Saved to: ${uri}`);
    return true;
  } catch (error) {
    console.error('PNG Card export failed:', error);
    Alert.alert('Export Failed', 'Could not generate card.');
    return false;
  }
}

// Legacy alias for backward compatibility
export { exportPDF as exportItineraryPDF };