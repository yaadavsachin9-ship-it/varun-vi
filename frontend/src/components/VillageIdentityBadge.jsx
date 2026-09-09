import React from 'react';
import { Droplets, Leaf, Mountain, Waves, Wind } from 'lucide-react';

const BADGE_PROFILES = [
  { match: ['raini'], label: 'Rishiganga glacier confluence', icon: Droplets, tone: 'ice' },
  { match: ['tapovan'], label: 'Dhauliganga valley', icon: Waves, tone: 'river' },
  { match: ['joshimath'], label: 'Alaknanda mountain ridge', icon: Mountain, tone: 'ridge' },
  { match: ['helang'], label: 'Alaknanda gorge', icon: Waves, tone: 'river' },
  { match: ['pipalkoti'], label: 'Alaknanda terrace', icon: Leaf, tone: 'forest' },
  { match: ['pandukeshwar'], label: 'Upper Alaknanda highland', icon: Mountain, tone: 'ridge' },
  { match: ['govindghat'], label: 'Alaknanda confluence', icon: Waves, tone: 'river' },
  { match: ['mana'], label: 'Saraswati headwaters', icon: Mountain, tone: 'snow' },
  { match: ['badrinath'], label: 'Alaknanda headwaters', icon: Mountain, tone: 'snow' },
  { match: ['urgam'], label: 'Kalpganga valley', icon: Leaf, tone: 'forest' },
  { match: ['tharali'], label: 'Pindar valley', icon: Waves, tone: 'river' },
  { match: ['darchula'], label: 'Mahakali gorge / Api Himal', icon: Mountain, tone: 'ridge' },
  { match: ['baitadi'], label: 'Surnaya foothills', icon: Leaf, tone: 'forest' },
  { match: ['jumla'], label: 'Upper Karnali highland', icon: Wind, tone: 'snow' },
  { match: ['pokhara'], label: 'Seti Gandaki / Phewa valley', icon: Waves, tone: 'lake' },
  { match: ['jomsom'], label: 'Kali Gandaki gorge', icon: Wind, tone: 'dry' },
  { match: ['melamchi'], label: 'Melamchi monsoon valley', icon: Droplets, tone: 'river' },
  { match: ['tatopani'], label: 'Bhote Koshi gorge', icon: Droplets, tone: 'hot' },
];

const DEFAULT_PROFILE = { label: 'Himalayan catchment', icon: Mountain, tone: 'ridge' };

function getProfile(village) {
  const name = village?.name?.toLowerCase() || '';
  return BADGE_PROFILES.find((profile) => profile.match.some((term) => name.includes(term))) || DEFAULT_PROFILE;
}

export default function VillageIdentityBadge({ village, compact = false }) {
  const profile = getProfile(village);
  const Icon = profile.icon;
  const risk = village?.current_risk_level || 'green';
  const riskTone = risk === 'red' ? 'risk-red' : risk === 'yellow' ? 'risk-yellow' : 'risk-green';

  return (
    <div className={`village-identity ${compact ? 'village-identity-compact' : ''} ${profile.tone} ${riskTone}`} title={`${village?.name || 'Village'} - ${profile.label}`}>
      <span className="village-identity-mark" aria-hidden="true">
        <Icon />
      </span>
      {!compact && (
        <span className="village-identity-copy">
          <strong>{village?.name || 'Himalayan sector'}</strong>
          <small>{profile.label}</small>
        </span>
      )}
    </div>
  );
}
