/**
 * Converter: slides.json format → Make Slides schema
 *
 * Transforms the z.ai-style JSON input format into our internal Deck schema.
 */

import type {
  Deck,
  Slide,
  Theme,
  SlideType,
  SlideElement,
  NumberedItem,
  TextBlock,
  IconCard,
  Callout,
  ComparisonRow,
  BackgroundConfig,
} from '../src/schema/slide.js';

// =============================================================================
// Input Types (slides.json format)
// =============================================================================

interface InputPresentation {
  presentation: {
    title: string;
    subtitle?: string;
    date?: string;
    prepared_for?: string;
    author?: string;
    deck_version?: number;
    theme: {
      name: string;
      fonts: {
        heading: string;
        body: string;
        light?: string;
      };
      colors: {
        primary: string;
        secondary: string;
        background: string;
        text: string;
        text_on_dark: string;
        text_muted?: string;
        success: string;
        warning: string;
        error: string;
      };
    };
  };
  slides: InputSlide[];
  metadata?: {
    created: string;
    version: number;
    slide_count: number;
    recommendation?: string;
  };
}

interface InputSlide {
  slide_number: number;
  type: string;
  title?: string;
  subtitle?: string;
  background?: string;
  footer?: string;
  prepared_for?: string;
  items?: string[];
  content?: InputSlideContent;
}

interface InputSlideContent {
  headline?: string;
  proposal?: {
    pattern: string;
    example: string;
  };
  stated_goals?: string[];
  acknowledgment?: string;
  requirements?: Array<{
    requirement: string;
    description: string;
    current_issue?: string;
    future_need?: string;
  }>;
  key_point?: string;
  salesforce_guidance?: string;
  common_email_changes?: Array<{
    scenario: string;
    example: string;
  }>;
  impact?: {
    before: string;
    after: string;
    result: string;
  };
  contrast?: string;
  example?: {
    person?: string;
    affiliations?: string[];
    with_prefix_pattern?: string[];
    result?: string;
  };
  sfmc_behavior?: string;
  consequences?: string[];
  model?: {
    identity?: {
      label: string;
      purpose: string;
      value: string;
      characteristic: string;
    };
    affiliation?: {
      label: string;
      purpose: string;
      examples: string[];
      characteristic: string;
    };
  };
  how_onetrust_works?: string;
  risk_scenario?: {
    action: string;
    onetrust_receives: string;
    sfmc_has: string;
    problem: string;
  };
  compliance_impact?: string;
  solution?: string;
  attentive_behavior?: string;
  with_prefix_pattern?: {
    challenge?: string;
    inbound?: string;
    outbound?: string;
    risk?: string;
    scenario?: string;
    example?: string;
    result?: string;
    data_cloud_sees?: string;
    consequence?: string;
  };
  with_contact_id?: {
    approach?: string;
    benefit?: string;
    scenario?: string;
    data_cloud_sees?: string;
  };
  mc_connector_requirements?: string;
  features_requiring_contact_id?: Array<{
    feature: string;
    description: string;
    without_contact_id: string;
  }>;
  how_data_cloud_works?: string;
  recommendation?: string;
  how_billing_works?: string;
  industry_observation?: string;
  best_practice?: string;
  what_bus_provide?: Array<{
    capability: string;
    description: string;
    benefit: string;
  }>;
  enterprise_2_feature?: string;
  architecture?: {
    subscriber_key: string;
    email_address: string;
    bu_membership: string[];
    consent_by_property: Record<string, boolean>;
  };
  how_it_works?: string[];
  context?: string;
  benefits?: Array<{
    benefit: string;
    detail: string;
  }>;
  requirements_met?: Array<{
    requirement: string;
    solution: string;
    status: string;
  }>;
  criteria?: Array<{
    factor: string;
    prefix_pattern: string;
    contact_id: string;
  }>;
  approach?: string;
  chris_context?: string;
  industry_context?: string;
  what_gets_deleted_in_sfmc?: string[];
  what_is_preserved?: Array<{
    item: string;
    location: string;
  }>;
  chris_noted?: string;
  considerations?: Array<{
    item: string;
    detail: string;
    owner: string;
  }>;
  phases?: Array<{
    phase: string;
    tasks: string[];
  }>;
  how_history_survives?: {
    pre_migration_data: string;
    post_migration_data: string;
    linkage: string;
  };
  use_cases?: Array<{
    need: string;
    solution: string;
  }>;
  why_not_prefix?: string[];
  why_contact_id?: string[];
  goals?: Array<{
    goal: string;
    solution: string;
    achieved: boolean;
  }>;
  decisions_needed?: Array<{
    decision: string;
    owner: string;
    detail: string;
  }>;
  nextactiv_deliverables?: string[];
  contact?: string;
  key_message?: string;
  company?: string;
  website?: string;
}

// =============================================================================
// Converter Functions
// =============================================================================

function mapSlideType(inputType: string): SlideType {
  const typeMap: Record<string, SlideType> = {
    title: 'title',
    agenda: 'agenda',
    section_divider: 'title', // Section dividers are like mini title slides
    content: 'content',
    comparison_table: 'comparison',
    closing: 'closing',
  };
  return typeMap[inputType] || 'content';
}

function createBackground(slide: InputSlide): BackgroundConfig | undefined {
  if (slide.background) {
    return {
      type: 'solid',
      color: slide.background,
    };
  }
  return undefined;
}

function convertTitleSlide(slide: InputSlide, theme: Theme): Slide {
  const elements: SlideElement[] = [];

  // Main title
  if (slide.title) {
    elements.push({
      type: 'text',
      content: slide.title,
      size: 'title',
      bold: true,
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  // Subtitle
  if (slide.subtitle) {
    elements.push({
      type: 'text',
      content: slide.subtitle,
      size: 'body',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  // Prepared for
  if (slide.prepared_for) {
    elements.push({
      type: 'text',
      content: `Prepared for ${slide.prepared_for}`,
      size: 'caption',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  // Footer
  if (slide.footer) {
    elements.push({
      type: 'text',
      content: slide.footer,
      size: 'caption',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  return {
    id: `slide-${slide.slide_number}`,
    slideType: 'title',
    background: createBackground(slide) || {
      type: 'gradient',
      gradient: {
        from: theme.colors.primary,
        to: theme.colors.primary,
        angle: 135,
      },
    },
    content: { elements },
  };
}

function convertAgendaSlide(slide: InputSlide, theme: Theme): Slide {
  const elements: SlideElement[] = [];

  if (slide.items) {
    slide.items.forEach((item, index) => {
      elements.push({
        type: 'numbered-item',
        number: index + 1,
        title: item,
      } as NumberedItem);
    });
  }

  return {
    id: `slide-${slide.slide_number}`,
    slideType: 'agenda',
    background: { type: 'solid', color: theme.colors.background.white },
    header: {
      title: slide.title || 'Agenda',
      backgroundColor: theme.colors.primary,
      textColor: theme.colors.text.inverse,
    },
    content: {
      layout: 'grid-2-column',
      elements,
    },
  };
}

function convertSectionDivider(slide: InputSlide, theme: Theme): Slide {
  const elements: SlideElement[] = [];

  if (slide.title) {
    elements.push({
      type: 'text',
      content: slide.title,
      size: 'title',
      bold: true,
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  if (slide.subtitle) {
    elements.push({
      type: 'text',
      content: slide.subtitle,
      size: 'body',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  return {
    id: `slide-${slide.slide_number}`,
    slideType: 'title',
    background: createBackground(slide) || {
      type: 'solid',
      color: theme.colors.primary,
    },
    content: { elements },
  };
}

function convertContentSlide(slide: InputSlide, theme: Theme): Slide {
  const elements: SlideElement[] = [];
  const content = slide.content;

  // Headline as a prominent text block
  if (content?.headline) {
    elements.push({
      type: 'text',
      content: content.headline,
      size: 'subheading',
      bold: true,
      color: theme.colors.text.dark,
    });
  }

  // Proposal box (for specific format)
  if (content?.proposal) {
    elements.push({
      type: 'callout',
      text: `Pattern: ${content.proposal.pattern}\nExample: ${content.proposal.example}`,
      variant: 'primary',
    } as Callout);
  }

  // Stated goals as icon cards or bullet points
  if (content?.stated_goals) {
    content.stated_goals.forEach((goal) => {
      elements.push({
        type: 'icon-card',
        icon: 'check_circle',
        title: goal,
        iconColor: theme.colors.positive,
      } as IconCard);
    });
  }

  // Requirements (two distinct needs)
  if (content?.requirements) {
    content.requirements.forEach((req) => {
      elements.push({
        type: 'icon-card',
        icon: 'assignment',
        title: req.requirement,
        description: req.description,
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Common email changes (scenarios)
  if (content?.common_email_changes) {
    content.common_email_changes.forEach((change) => {
      elements.push({
        type: 'icon-card',
        icon: 'swap_horiz',
        title: change.scenario,
        description: change.example,
        iconColor: theme.colors.warning,
      } as IconCard);
    });
  }

  // Benefits list
  if (content?.benefits) {
    content.benefits.forEach((benefit) => {
      elements.push({
        type: 'icon-card',
        icon: 'check_circle',
        title: benefit.benefit,
        description: benefit.detail,
        iconColor: theme.colors.positive,
      } as IconCard);
    });
  }

  // MC Connector requirements
  if (content?.mc_connector_requirements) {
    elements.push({
      type: 'callout',
      text: String(content.mc_connector_requirements),
      icon: 'sync',
      variant: 'primary',
    } as Callout);
  }

  // Features requiring Contact ID
  if (content?.features_requiring_contact_id) {
    content.features_requiring_contact_id.forEach((feature) => {
      elements.push({
        type: 'icon-card',
        icon: 'integration_instructions',
        title: feature.feature,
        description: `${feature.description}\n\nWithout Contact ID: ${feature.without_contact_id}`,
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // What BUs provide
  if (content?.what_bus_provide) {
    content.what_bus_provide.forEach((item) => {
      elements.push({
        type: 'icon-card',
        icon: 'business',
        title: item.capability,
        description: `${item.description}\n\n${item.benefit}`,
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Requirements met (checklist)
  if (content?.requirements_met) {
    content.requirements_met.forEach((req) => {
      elements.push({
        type: 'icon-card',
        icon: req.status === 'achieved' ? 'check_circle' : 'pending',
        title: req.requirement,
        description: req.solution,
        iconColor: req.status === 'achieved' ? theme.colors.positive : theme.colors.warning,
      } as IconCard);
    });
  }

  // Goals achieved
  if (content?.goals) {
    content.goals.forEach((goal) => {
      elements.push({
        type: 'icon-card',
        icon: goal.achieved ? 'check_circle' : 'cancel',
        title: goal.goal,
        description: goal.solution,
        iconColor: goal.achieved ? theme.colors.positive : theme.colors.negative,
      } as IconCard);
    });
  }

  // Considerations
  if (content?.considerations) {
    content.considerations.forEach((item) => {
      elements.push({
        type: 'icon-card',
        icon: 'info',
        title: `${item.item} (${item.owner})`,
        description: item.detail,
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Phases
  if (content?.phases) {
    content.phases.forEach((phase) => {
      elements.push({
        type: 'icon-card',
        icon: 'timeline',
        title: phase.phase,
        description: phase.tasks.map((t) => `• ${t}`).join('\n'),
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Decisions needed
  if (content?.decisions_needed) {
    content.decisions_needed.forEach((dec) => {
      elements.push({
        type: 'icon-card',
        icon: 'help_outline',
        title: dec.decision,
        description: `Owner: ${dec.owner}\n${dec.detail}`,
        iconColor: theme.colors.warning,
      } as IconCard);
    });
  }

  // Why not prefix / Why contact ID
  if (content?.why_not_prefix) {
    content.why_not_prefix.forEach((reason) => {
      elements.push({
        type: 'icon-card',
        icon: 'cancel',
        title: reason,
        iconColor: theme.colors.negative,
      } as IconCard);
    });
  }

  if (content?.why_contact_id) {
    content.why_contact_id.forEach((reason) => {
      elements.push({
        type: 'icon-card',
        icon: 'check_circle',
        title: reason,
        iconColor: theme.colors.positive,
      } as IconCard);
    });
  }

  // Key point as callout
  if (content?.key_point) {
    elements.push({
      type: 'callout',
      text: content.key_point,
      icon: 'lightbulb',
      variant: 'primary',
    } as Callout);
  }

  // Acknowledgment as callout
  if (content?.acknowledgment) {
    elements.push({
      type: 'callout',
      text: content.acknowledgment,
      icon: 'thumb_up',
      variant: 'positive',
    } as Callout);
  }

  // Salesforce guidance
  if (content?.salesforce_guidance) {
    elements.push({
      type: 'callout',
      text: content.salesforce_guidance,
      icon: 'cloud',
      variant: 'primary',
    } as Callout);
  }

  // Industry observation
  if (content?.industry_observation) {
    elements.push({
      type: 'callout',
      text: content.industry_observation,
      icon: 'insights',
      variant: 'warning',
    } as Callout);
  }

  // Best practice
  if (content?.best_practice) {
    elements.push({
      type: 'callout',
      text: content.best_practice,
      icon: 'verified',
      variant: 'positive',
    } as Callout);
  }

  // Example with person/affiliations
  if (content?.example) {
    const ex = content.example as Record<string, unknown>;
    if (ex.person) {
      elements.push({
        type: 'icon-card',
        icon: 'person',
        title: String(ex.person),
        description: Array.isArray(ex.affiliations)
          ? `Affiliations: ${ex.affiliations.join(', ')}`
          : undefined,
        iconColor: theme.colors.primary,
      } as IconCard);
    }
    if (ex.with_prefix_pattern && Array.isArray(ex.with_prefix_pattern)) {
      ex.with_prefix_pattern.forEach((pattern: unknown) => {
        elements.push({
          type: 'icon-card',
          icon: 'key',
          title: String(pattern),
          iconColor: theme.colors.warning,
        } as IconCard);
      });
    }
    if (ex.result) {
      elements.push({
        type: 'callout',
        text: String(ex.result),
        icon: 'warning',
        variant: 'negative',
      } as Callout);
    }
  }

  // SFMC behavior
  if (content?.sfmc_behavior) {
    elements.push({
      type: 'callout',
      text: content.sfmc_behavior,
      icon: 'cloud',
      variant: 'primary',
    } as Callout);
  }

  // Consequences
  if (content?.consequences) {
    content.consequences.forEach((consequence: string) => {
      elements.push({
        type: 'icon-card',
        icon: 'warning',
        title: consequence,
        iconColor: theme.colors.negative,
      } as IconCard);
    });
  }

  // Model (identity/affiliation pattern)
  if (content?.model) {
    const model = content.model as Record<string, unknown>;
    if (model.identity && typeof model.identity === 'object') {
      const identity = model.identity as Record<string, string>;
      elements.push({
        type: 'icon-card',
        icon: 'fingerprint',
        title: identity.label || 'Identity',
        description: `${identity.purpose}\n${identity.value}\n${identity.characteristic}`,
        iconColor: theme.colors.primary,
      } as IconCard);
    }
    if (model.affiliation && typeof model.affiliation === 'object') {
      const affiliation = model.affiliation as Record<string, unknown>;
      elements.push({
        type: 'icon-card',
        icon: 'groups',
        title: String(affiliation.label || 'Affiliation'),
        description: `${affiliation.purpose}\n${Array.isArray(affiliation.examples) ? affiliation.examples.join('\n') : ''}\n${affiliation.characteristic}`,
        iconColor: theme.colors.positive,
      } as IconCard);
    }
  }

  // Impact (before/after/result)
  if (content?.impact) {
    const impact = content.impact;
    elements.push({
      type: 'icon-card',
      icon: 'compare_arrows',
      title: 'Before',
      description: impact.before,
      iconColor: theme.colors.negative,
    } as IconCard);
    elements.push({
      type: 'icon-card',
      icon: 'arrow_forward',
      title: 'After',
      description: impact.after,
      iconColor: theme.colors.positive,
    } as IconCard);
    if (impact.result) {
      elements.push({
        type: 'callout',
        text: impact.result,
        icon: 'check_circle',
        variant: 'positive',
      } as Callout);
    }
  }

  // How it works
  if (content?.how_it_works) {
    const how = content.how_it_works as Record<string, unknown>;
    Object.entries(how).forEach(([key, value]) => {
      elements.push({
        type: 'icon-card',
        icon: 'settings',
        title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: String(value),
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Architecture
  if (content?.architecture) {
    const arch = content.architecture as Record<string, unknown>;
    Object.entries(arch).forEach(([key, value]) => {
      elements.push({
        type: 'icon-card',
        icon: 'architecture',
        title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: String(value),
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Context
  if (content?.context) {
    elements.push({
      type: 'callout',
      text: String(content.context),
      icon: 'info',
      variant: 'primary',
    } as Callout);
  }

  // Result
  if (content?.result) {
    elements.push({
      type: 'callout',
      text: String(content.result),
      icon: 'check_circle',
      variant: 'positive',
    } as Callout);
  }

  // Use cases
  if (content?.use_cases) {
    content.use_cases.forEach((uc: { need: string; solution: string }) => {
      elements.push({
        type: 'icon-card',
        icon: 'lightbulb',
        title: uc.need,
        description: uc.solution,
        iconColor: theme.colors.primary,
      } as IconCard);
    });
  }

  // Recommendation
  if (content?.recommendation) {
    elements.push({
      type: 'callout',
      text: String(content.recommendation),
      icon: 'thumb_up',
      variant: 'positive',
    } as Callout);
  }

  // Risk scenario
  if (content?.risk_scenario) {
    const risk = content.risk_scenario as Record<string, string>;
    elements.push({
      type: 'callout',
      text: `${risk.scenario || ''}\n${risk.consequence || ''}`,
      icon: 'warning',
      variant: 'negative',
    } as Callout);
  }

  // What gets deleted / What is preserved
  if (content?.what_gets_deleted_in_sfmc) {
    elements.push({
      type: 'icon-card',
      icon: 'delete',
      title: 'What Gets Deleted',
      description: String(content.what_gets_deleted_in_sfmc),
      iconColor: theme.colors.negative,
    } as IconCard);
  }

  if (content?.what_is_preserved) {
    elements.push({
      type: 'icon-card',
      icon: 'save',
      title: 'What Is Preserved',
      description: String(content.what_is_preserved),
      iconColor: theme.colors.positive,
    } as IconCard);
  }

  // Data Cloud Considerations patterns (Slide 15)
  if (content?.how_data_cloud_works) {
    elements.push({
      type: 'callout',
      text: String(content.how_data_cloud_works),
      icon: 'cloud',
      variant: 'primary',
    } as Callout);
  }

  // with_prefix_pattern as object (not array) - multiple variants
  const prefixPattern = content?.with_prefix_pattern as Record<string, string> | undefined;
  if (prefixPattern && typeof prefixPattern === 'object' && !Array.isArray(prefixPattern)) {
    // Build description from all string values in the object
    const descParts: string[] = [];
    if (prefixPattern.scenario) descParts.push(`Scenario: ${prefixPattern.scenario}`);
    if (prefixPattern.data_cloud_sees) descParts.push(`Data Cloud Sees: ${prefixPattern.data_cloud_sees}`);
    if (prefixPattern.consequence) descParts.push(`Consequence: ${prefixPattern.consequence}`);
    if (prefixPattern.challenge) descParts.push(`Challenge: ${prefixPattern.challenge}`);
    if (prefixPattern.inbound) descParts.push(`Inbound: ${prefixPattern.inbound}`);
    if (prefixPattern.outbound) descParts.push(`Outbound: ${prefixPattern.outbound}`);
    if (prefixPattern.risk) descParts.push(`Risk: ${prefixPattern.risk}`);

    elements.push({
      type: 'icon-card',
      icon: 'warning',
      title: 'With Prefix Pattern',
      description: descParts.join('\n'),
      iconColor: theme.colors.negative,
    } as IconCard);
  }

  // with_contact_id pattern - multiple variants
  const contactIdPattern = content?.with_contact_id as Record<string, string> | undefined;
  if (contactIdPattern && typeof contactIdPattern === 'object') {
    const descParts: string[] = [];
    if (contactIdPattern.scenario) descParts.push(`Scenario: ${contactIdPattern.scenario}`);
    if (contactIdPattern.data_cloud_sees) descParts.push(`Data Cloud Sees: ${contactIdPattern.data_cloud_sees}`);
    if (contactIdPattern.benefit) descParts.push(`Benefit: ${contactIdPattern.benefit}`);
    if (contactIdPattern.approach) descParts.push(`Approach: ${contactIdPattern.approach}`);

    elements.push({
      type: 'icon-card',
      icon: 'check_circle',
      title: 'With Contact ID',
      description: descParts.join('\n'),
      iconColor: theme.colors.positive,
    } as IconCard);
  }

  // Attentive behavior
  if (content?.attentive_behavior) {
    elements.push({
      type: 'callout',
      text: String(content.attentive_behavior),
      icon: 'sms',
      variant: 'primary',
    } as Callout);
  }

  // Fallback: if no elements, add a placeholder
  if (elements.length === 0 && content) {
    // Extract any string values from content
    const textContent = Object.entries(content)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n\n');

    if (textContent) {
      elements.push({
        type: 'text',
        content: textContent,
        size: 'body',
        color: theme.colors.text.medium,
      });
    }
  }

  return {
    id: `slide-${slide.slide_number}`,
    slideType: 'content',
    background: { type: 'solid', color: theme.colors.background.white },
    header: slide.title ? {
      title: slide.title,
      backgroundColor: theme.colors.primary,
      textColor: theme.colors.text.inverse,
    } : undefined,
    content: {
      layout: elements.length <= 2 ? 'flex-column' : 'grid-2-column',
      elements,
    },
  };
}

function convertComparisonSlide(slide: InputSlide, theme: Theme): Slide {
  const elements: SlideElement[] = [];
  const content = slide.content;

  if (content?.criteria) {
    // Add header row
    elements.push({
      type: 'comparison-row',
      label: 'Factor',
      columns: [
        { value: 'Prefix Pattern', sentiment: 'neutral' },
        { value: 'Contact ID', sentiment: 'neutral' },
      ],
    } as ComparisonRow);

    // Add data rows
    content.criteria.forEach((row) => {
      elements.push({
        type: 'comparison-row',
        label: row.factor,
        columns: [
          {
            value: row.prefix_pattern,
            sentiment: row.prefix_pattern.toLowerCase().includes('yes') ? 'positive' :
                       row.prefix_pattern.toLowerCase().includes('no') ||
                       row.prefix_pattern.toLowerCase().includes('lost') ||
                       row.prefix_pattern.toLowerCase().includes('inflated') ||
                       row.prefix_pattern.toLowerCase().includes('fragmented') ? 'negative' : 'neutral'
          },
          {
            value: row.contact_id,
            sentiment: row.contact_id.toLowerCase().includes('yes') ||
                       row.contact_id.toLowerCase().includes('full') ||
                       row.contact_id.toLowerCase().includes('native') ||
                       row.contact_id.toLowerCase().includes('unified') ||
                       row.contact_id.toLowerCase().includes('one per') ? 'positive' : 'neutral'
          },
        ],
      } as ComparisonRow);
    });
  }

  return {
    id: `slide-${slide.slide_number}`,
    slideType: 'comparison',
    background: { type: 'solid', color: theme.colors.background.white },
    header: slide.title ? {
      title: slide.title,
      backgroundColor: theme.colors.primary,
      textColor: theme.colors.text.inverse,
    } : undefined,
    content: {
      layout: 'flex-column',
      elements,
    },
  };
}

function convertClosingSlide(slide: InputSlide, theme: Theme): Slide {
  const elements: SlideElement[] = [];
  const content = slide.content;

  if (slide.title) {
    elements.push({
      type: 'text',
      content: slide.title,
      size: 'title',
      bold: true,
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  if (content?.key_message) {
    elements.push({
      type: 'text',
      content: content.key_message,
      size: 'body',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  if (content?.contact) {
    elements.push({
      type: 'text',
      content: content.contact,
      size: 'body',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  if (content?.company && content?.website) {
    elements.push({
      type: 'text',
      content: `${content.company} | ${content.website}`,
      size: 'caption',
      color: theme.colors.text.inverse,
      align: 'center',
    });
  }

  return {
    id: `slide-${slide.slide_number}`,
    slideType: 'closing',
    background: createBackground(slide) || {
      type: 'gradient',
      gradient: {
        from: theme.colors.primary,
        to: theme.colors.primary,
        angle: 135,
      },
    },
    content: { elements },
  };
}

function convertSlide(slide: InputSlide, theme: Theme): Slide {
  switch (slide.type) {
    case 'title':
      return convertTitleSlide(slide, theme);
    case 'agenda':
      return convertAgendaSlide(slide, theme);
    case 'section_divider':
      return convertSectionDivider(slide, theme);
    case 'content':
      return convertContentSlide(slide, theme);
    case 'comparison_table':
      return convertComparisonSlide(slide, theme);
    case 'closing':
      return convertClosingSlide(slide, theme);
    default:
      return convertContentSlide(slide, theme);
  }
}

// =============================================================================
// Main Converter
// =============================================================================

export function convertPresentation(input: InputPresentation): Deck {
  const inputTheme = input.presentation.theme;

  const theme: Theme = {
    name: inputTheme.name,
    fonts: {
      heading: inputTheme.fonts.heading,
      body: inputTheme.fonts.body,
      special: inputTheme.fonts.light,
    },
    colors: {
      primary: inputTheme.colors.primary,
      secondary: inputTheme.colors.secondary,
      positive: inputTheme.colors.success,
      negative: inputTheme.colors.error,
      warning: inputTheme.colors.warning,
      text: {
        // Z.AI PPTX uses #595959 for body text, not #000000 from their JSON API
        dark: '#595959',  // Body/paragraph text (validated from slide15.xml)
        medium: '#595959',  // Same as dark for consistency
        light: '#666666',  // Muted text
        // Z.AI PPTX uses #FFFFFF for text on dark backgrounds, not #EEEEEE
        inverse: '#FFFFFF',  // Header text on blue (validated from slide15.xml)
      },
      background: {
        white: '#FFFFFF',  // Pure white
        light: '#FFFFFF',  // Z.AI uses pure white for content slides
        dark: '#333333',
      },
    },
    slideSize: {
      width: 1280,
      height: 720,
    },
  };

  const slides = input.slides.map((slide) => convertSlide(slide, theme));

  return {
    id: `deck-${Date.now()}`,
    title: input.presentation.title,
    theme,
    slides,
    author: input.presentation.author,
    createdAt: input.metadata?.created || new Date().toISOString(),
  };
}

// =============================================================================
// CLI Usage
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputPath = process.argv[2] || path.join(__dirname, '../data/z-ai-research/slides.json');
  const outputPath = process.argv[3] || path.join(__dirname, '../data/z-ai-research/slides-converted.json');

  console.log(`Reading: ${inputPath}`);
  const inputJson = fs.readFileSync(inputPath, 'utf-8');
  const input = JSON.parse(inputJson) as InputPresentation;

  console.log(`Converting ${input.slides.length} slides...`);
  const deck = convertPresentation(input);

  console.log(`Writing: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(deck, null, 2));

  console.log('Done!');
  console.log(`  Deck: ${deck.title}`);
  console.log(`  Slides: ${deck.slides.length}`);
  console.log(`  Theme: ${deck.theme.name}`);
}

main().catch(console.error);
