// Punto question schema. Each question:
//   id: profile key (must match what content.js fills)
//   section: section label
//   prompt: user-facing question
//   type: text | email | tel | date | textarea | select | radio | signature
//   options: for select/radio
//   placeholder, help, optional
const QUESTIONS = [
  // ---- Identity ----
  { id: "firstName", section: "Identity", type: "text", prompt: "What's your legal first name?", placeholder: "First name" },
  { id: "middleName", section: "Identity", type: "text", prompt: "Middle name?", placeholder: "Optional", optional: true },
  { id: "lastName", section: "Identity", type: "text", prompt: "Legal last name?", placeholder: "Last name" },
  { id: "preferredName", section: "Identity", type: "text", prompt: "Preferred name?", help: "What you'd like to be called, if different from your legal first name.", optional: true },
  { id: "pronouns", section: "Identity", type: "select", prompt: "Pronouns?", optional: true,
    options: ["", "She/Her", "He/Him", "They/Them", "Prefer not to say"] },

  // ---- Contact ----
  { id: "email", section: "Contact", type: "email", prompt: "Email address?", placeholder: "you@example.com" },
  { id: "phone", section: "Contact", type: "tel", prompt: "Phone number?", placeholder: "+1 555 123 4567" },
  { id: "phoneType", section: "Contact", type: "radio", prompt: "Phone type?",
    options: ["Mobile", "Home", "Work"] },

  // ---- Address ----
  { id: "country", section: "Address", type: "text", prompt: "Country?", placeholder: "United States of America",
    help: "Use the full country name. Workday usually expects 'United States of America', not 'USA'." },
  { id: "address1", section: "Address", type: "text", prompt: "Street address?", placeholder: "123 Main St" },
  { id: "address2", section: "Address", type: "text", prompt: "Apt / Suite / Unit?", optional: true },
  { id: "city", section: "Address", type: "text", prompt: "City?" },
  { id: "state", section: "Address", type: "text", prompt: "State or region?", placeholder: "Massachusetts" },
  { id: "postalCode", section: "Address", type: "text", prompt: "ZIP / postal code?" },

  // ---- Work Authorization ----
  { id: "legallyAuthorized", section: "Work Authorization", type: "radio",
    prompt: "Are you legally authorized to work in the country where this job is located?",
    options: ["Yes", "No"] },
  { id: "requiresSponsorship", section: "Work Authorization", type: "radio",
    prompt: "Will you now or in the future require sponsorship for employment visa status?",
    options: ["Yes", "No"] },
  { id: "willingToRelocate", section: "Work Authorization", type: "radio",
    prompt: "Are you willing to relocate / work at the job's specified location?",
    help: "Used for 'willing to relocate' and 'able to work at this location' questions.",
    options: ["Yes", "No"] },
  { id: "exportControlStatus", section: "Work Authorization", type: "radio",
    prompt: "U.S. Export Control status?",
    help: "Used for ITAR / technical data export control questions. 'U.S. Person' = U.S. citizen, permanent resident, asylee, or refugee.",
    options: ["I am a U.S. Person", "I am not a U.S. Person", "Prefer not to say"] },
  { id: "availableFullDuration", section: "Work Authorization", type: "radio",
    prompt: "Are you available for the full duration of co-op/internship programs you apply to?",
    options: ["Yes", "No"] },
  { id: "healthcareProfessional", section: "Work Authorization", type: "radio",
    prompt: "Are you a healthcare professional or part of a healthcare organization?",
    help: "Conflict-of-interest disclosure asked by many companies. Most candidates answer No.",
    options: ["Yes", "No"] },
  { id: "desiredSalary", section: "Work Authorization", type: "text",
    prompt: "Desired annual salary?", placeholder: "$120,000",
    help: "You can enter a range or 'Negotiable'.", optional: true },
  { id: "startDate", section: "Work Authorization", type: "date",
    prompt: "Earliest date you can start?", optional: true },

  // ---- Education ----
  { id: "school", section: "Education", type: "text", prompt: "Most recent school?", placeholder: "Northeastern University" },
  { id: "degree", section: "Education", type: "select", prompt: "Degree?",
    options: ["", "High School", "Associate's", "Bachelor's", "Master's", "PhD", "Other"] },
  { id: "major", section: "Education", type: "text", prompt: "Major / field of study?", placeholder: "Computer Science" },
  { id: "gpa", section: "Education", type: "text", prompt: "GPA?", placeholder: "3.8", optional: true },
  { id: "gradMonth", section: "Education", type: "select", prompt: "Graduation month?",
    options: ["", "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"] },
  { id: "gradYear", section: "Education", type: "text", prompt: "Graduation year?", placeholder: "2026" },
  { id: "graduationDate", section: "Education", type: "date",
    prompt: "Anticipated graduation date?",
    help: "Used when an application asks for a specific date (not just month/year)." },
  { id: "enteredEducationOnApplication", section: "Education", type: "radio",
    prompt: "Did you enter (or will you enter) your school in the application's Education / My Experience section?",
    help: "Workday-style applications ask this. Almost always Yes if you fill in Education when prompted.",
    options: ["Yes", "No"] },

  // ---- Experience ----
  { id: "company", section: "Experience", type: "text", prompt: "Most recent company?", optional: true },
  { id: "title", section: "Experience", type: "text", prompt: "Most recent job title?", optional: true },
  { id: "yearsExperience", section: "Experience", type: "text", prompt: "Total years of professional experience?", placeholder: "3", optional: true },

  // ---- Demographics & EEO ----
  { id: "gender", section: "Demographics", type: "radio", prompt: "Gender?",
    help: "Optional. Federal contractors are required to ask, but you can decline.",
    options: ["Male", "Female", "Non-binary", "Prefer not to say"] },
  { id: "hispanic", section: "Demographics", type: "radio", prompt: "Are you Hispanic or Latino?",
    options: ["Yes", "No", "Prefer not to say"] },
  { id: "ethnicity", section: "Demographics", type: "select", prompt: "Race / ethnicity?",
    options: ["", "Asian", "Black or African American", "Hispanic or Latino",
              "Native Hawaiian or Other Pacific Islander", "White",
              "Two or More Races", "American Indian or Alaska Native", "Prefer not to say"] },
  { id: "veteran", section: "Demographics", type: "radio", prompt: "Veteran status?",
    options: [
      "I am not a protected veteran",
      "I identify as one or more of the classifications of a protected veteran",
      "I do not wish to answer"
    ] },
  { id: "disability", section: "Demographics", type: "radio", prompt: "Disability status?",
    options: [
      "No, I do not have a disability",
      "Yes, I have a disability",
      "I do not wish to answer"
    ] },

  // ---- Legal Disclosures ----
  { id: "age18", section: "Legal", type: "radio", prompt: "Are you at least 18 years of age?",
    options: ["Yes", "No"] },
  { id: "felonyConviction", section: "Legal", type: "radio",
    prompt: "Have you ever been convicted of a felony?",
    help: "Many jurisdictions restrict when employers can ask. Answer accurately — the autofill will use this only when the application asks.",
    options: ["Yes", "No", "Prefer not to say"] },
  { id: "backgroundCheckConsent", section: "Legal", type: "radio",
    prompt: "Do you consent to a background check if required?",
    options: ["Yes", "No"] },
  { id: "drugTestConsent", section: "Legal", type: "radio",
    prompt: "Do you consent to drug testing if required?",
    options: ["Yes", "No"] },
  { id: "nonCompete", section: "Legal", type: "radio",
    prompt: "Are you currently bound by a non-compete or other restrictive agreement?",
    options: ["Yes", "No"] },
  { id: "previouslyEmployed", section: "Legal", type: "radio",
    prompt: "Have you previously been employed by this company?",
    help: "Set the most common answer for you. You can override per-application.",
    options: ["Yes", "No"] },
  { id: "referredByEmployee", section: "Legal", type: "radio",
    prompt: "Were you referred by a current employee?",
    options: ["Yes", "No"] },

  // ---- Links ----
  { id: "linkedin", section: "Links", type: "text", prompt: "LinkedIn URL?", placeholder: "https://linkedin.com/in/...", optional: true },
  { id: "github", section: "Links", type: "text", prompt: "GitHub URL?", optional: true },
  { id: "portfolio", section: "Links", type: "text", prompt: "Portfolio URL?", optional: true },
  { id: "website", section: "Links", type: "text", prompt: "Personal website?", optional: true },
  { id: "source", section: "Links", type: "text", prompt: "How did you hear about us? (default answer)",
    placeholder: "LinkedIn", optional: true,
    help: "Used as a fallback when the application asks. You can override per-application." },

  // ---- Signature ----
  { id: "signatureName", section: "Signature", type: "text",
    prompt: "Type your full legal name as your electronic signature.",
    help: "This will be filled into 'Signature' or 'Type your name' fields on applications.",
    placeholder: "First Middle Last" },
  { id: "signatureDrawn", section: "Signature", type: "signature",
    prompt: "Draw your signature (optional)",
    help: "Used when an application has a drawable signature pad. Skip if you only need typed signatures.",
    optional: true },
];

window.QUESTIONS = QUESTIONS;
