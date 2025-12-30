'use strict';

// Postmonger Connection
let connection = new Postmonger.Session();
let payload = {};
let lastStepEnabled = false;
let steps = [{ label: 'Configure', key: 'configure' }, { label: 'Configurando Mensagem', key: 'step-2' }];
let currentStepIndex = 0;
let currentStep = steps[0].key;

// Field configurations from builder
const fieldConfigs = [
  {
    "id": "116511b1-c120-47b5-af94-32a4f3b25377",
    "type": "text-input",
    "required": true,
    "validation": {
      "minLength": 10,
      "maxLength": 60
    },
    "webServices": [],
    "eventHandlers": [],
    "conditionalVisibility": null,
    "customInit": null
  },
  {
    "id": "42253143-a8a7-4c2e-8fa6-0ef670884a7c",
    "type": "text-input",
    "required": false,
    "validation": null,
    "webServices": [],
    "eventHandlers": [],
    "conditionalVisibility": null,
    "customInit": null
  },
  {
    "id": "b91a69ee-db45-4e88-956c-8ea5df54a3cb",
    "type": "textarea",
    "required": false,
    "validation": null,
    "webServices": [],
    "eventHandlers": [],
    "conditionalVisibility": null,
    "customInit": null
  }
];

$(window).ready(onRender);

connection.on('initActivity', initialize);
connection.on('requestedTokens', onGetTokens);
connection.on('requestedEndpoints', onGetEndpoints);
connection.on('clickedNext', onClickedNext);
connection.on('clickedBack', onClickedBack);
connection.on('gotoStep', onGotoStep);

function onRender() {
  connection.trigger('ready');
  connection.trigger('requestTokens');
  connection.trigger('requestEndpoints');
  
  // Initialize field event handlers
  initializeEventHandlers();
  
  // Initialize conditional visibility
  initializeConditionalFields();
  
  // Run custom init scripts
  runCustomInitScripts();
  
  // Show/hide steps based on current step
  showCurrentStep();
}

function showCurrentStep() {
  // Hide all step containers
  $('.step-container').hide();
  // Show current step
  $('#step-' + currentStep).show();
  
  // Update step indicators if they exist
  $('.step-indicator').removeClass('active completed');
  steps.forEach(function(step, index) {
    var $indicator = $('#indicator-' + step.key);
    if (index < currentStepIndex) {
      $indicator.addClass('completed');
    } else if (index === currentStepIndex) {
      $indicator.addClass('active');
    }
  });
}

function initialize(data) {
  console.log('Initialize:', data);
  
  if (data) {
    payload = data;
  }
  
  const hasInArguments = Boolean(
    payload['arguments'] &&
    payload['arguments'].execute &&
    payload['arguments'].execute.inArguments &&
    payload['arguments'].execute.inArguments.length > 0
  );

  const inArguments = hasInArguments
    ? payload['arguments'].execute.inArguments
    : [];

  // Populate form with saved values
  inArguments.forEach(function(arg) {
    const key = Object.keys(arg)[0];
    const value = arg[key];
    const $field = $('#' + key);
    
    if ($field.length) {
      if ($field.is(':checkbox')) {
        $field.prop('checked', value === true || value === 'true');
      } else if ($field.is(':radio')) {
        $('input[name="' + key + '"][value="' + value + '"]').prop('checked', true);
      } else {
        $field.val(value);
      }
    }
  });

  // Re-evaluate conditional visibility after loading values
  evaluateConditionalFields();
  
  updateButtons();
}

function updateButtons() {
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  
  // Update next button text
  connection.trigger('updateButton', {
    button: 'next',
    text: isLastStep ? 'Done' : 'Next',
    visible: true
  });
  
  // Update back button
  connection.trigger('updateButton', {
    button: 'back',
    visible: !isFirstStep
  });
}

function onGetTokens(tokens) {
  console.log('Tokens:', tokens);
}

function onGetEndpoints(endpoints) {
  console.log('Endpoints:', endpoints);
}

function onClickedNext() {
  // Validate current step before proceeding
  if (!validateCurrentStep()) {
    return;
  }
  
  if (currentStepIndex < steps.length - 1) {
    // Go to next step
    currentStepIndex++;
    currentStep = steps[currentStepIndex].key;
    showCurrentStep();
    updateButtons();
    connection.trigger('nextStep');
  } else {
    // Last step - save and close
    save();
  }
}

function onClickedBack() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    currentStep = steps[currentStepIndex].key;
    showCurrentStep();
    updateButtons();
    connection.trigger('prevStep');
  }
}

function onGotoStep(step) {
  const stepIndex = steps.findIndex(function(s) { return s.key === step.key; });
  if (stepIndex >= 0) {
    currentStepIndex = stepIndex;
    currentStep = step.key;
    showCurrentStep();
    updateButtons();
  }
}

// =====================
// VALIDATION
// =====================
function validateCurrentStep() {
  var isValid = true;
  
  $('#step-' + currentStep).find('input, textarea, select').each(function() {
    const $field = $(this);
    const fieldId = $field.attr('name') || $field.attr('id');
    const fieldConfig = fieldConfigs.find(f => f.id === fieldId);
    
    // Clear previous errors
    $field.removeClass('error');
    
    // Skip hidden fields
    if ($field.closest('.form-group').hasClass('field-hidden') || $field.closest('.form-group').is(':hidden')) {
      return;
    }
    
    const value = $field.is(':checkbox') ? $field.is(':checked') : $field.val();
    
    // Required validation
    if ($field.attr('required') && !value) {
      $field.addClass('error');
      isValid = false;
      return;
    }
    
    // Skip further validation if empty and not required
    if (!value) return;
    
    if (fieldConfig && fieldConfig.validation) {
      const val = fieldConfig.validation;
      
      // Min/Max length
      if (val.minLength && String(value).length < val.minLength) {
        $field.addClass('error');
        isValid = false;
        return;
      }
      if (val.maxLength && String(value).length > val.maxLength) {
        $field.addClass('error');
        isValid = false;
        return;
      }
      
      // Pattern validation
      if (val.pattern) {
        const regex = new RegExp(val.pattern);
        if (!regex.test(String(value))) {
          $field.addClass('error');
          isValid = false;
          return;
        }
      }
      
      // Custom validation function
      if (val.customValidation) {
        try {
          const customFn = new Function('value', 'field', val.customValidation);
          const result = customFn(value, $field);
          if (result === false) {
            $field.addClass('error');
            isValid = false;
            return;
          }
        } catch (e) {
          console.error('Custom validation error:', e);
        }
      }
    }
  });
  
  return isValid;
}

// =====================
// WEB SERVICES
// =====================
function callWebService(serviceConfig, fieldId, triggerEvent) {
  const $field = $('#' + fieldId);
  const $formGroup = $field.closest('.form-group');
  
  // Build URL with placeholders
  let url = serviceConfig.url;
  $('form').find('input, textarea, select').each(function() {
    const name = $(this).attr('name') || $(this).attr('id');
    const val = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
    url = url.replace(new RegExp('{{' + name + '}}', 'g'), encodeURIComponent(val || ''));
  });
  
  // Build body with placeholders
  let body = serviceConfig.body || '';
  $('form').find('input, textarea, select').each(function() {
    const name = $(this).attr('name') || $(this).attr('id');
    const val = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
    body = body.replace(new RegExp('{{' + name + '}}', 'g'), val || '');
  });
  
  $formGroup.addClass('field-loading');
  
  $.ajax({
    url: url,
    method: serviceConfig.method || 'GET',
    data: body ? JSON.parse(body) : undefined,
    contentType: 'application/json',
    success: function(response) {
      console.log('Web service response:', response);
      
      // Map response to field if configured
      if (serviceConfig.responseMapping) {
        try {
          const mappingFn = new Function('response', 'field', serviceConfig.responseMapping);
          mappingFn(response, $field);
        } catch (e) {
          console.error('Response mapping error:', e);
        }
      }
    },
    error: function(xhr, status, error) {
      console.error('Web service error:', error);
    },
    complete: function() {
      $formGroup.removeClass('field-loading');
    }
  });
}

// =====================
// EVENT HANDLERS
// =====================
function initializeEventHandlers() {
  fieldConfigs.forEach(function(config) {
    if (!config.eventHandlers || !config.eventHandlers.length) return;
    
    const $field = $('#' + config.id);
    if (!$field.length) return;
    
    config.eventHandlers.forEach(function(handler) {
      $field.on(handler.event, function(e) {
        try {
          const handlerFn = new Function('event', 'field', 'value', handler.handler);
          const value = $field.is(':checkbox') ? $field.is(':checked') : $field.val();
          handlerFn(e, $field, value);
        } catch (err) {
          console.error('Event handler error:', err);
        }
      });
    });
    
    // Initialize web service triggers
    if (config.webServices && config.webServices.length) {
      config.webServices.forEach(function(ws) {
        if (ws.trigger === 'load') {
          callWebService(ws, config.id, 'load');
        } else {
          $field.on(ws.trigger, function() {
            callWebService(ws, config.id, ws.trigger);
          });
        }
      });
    }
  });
}

// =====================
// CONDITIONAL VISIBILITY
// =====================
function initializeConditionalFields() {
  // Attach change listeners to all fields
  $('form').find('input, textarea, select').on('change input', function() {
    evaluateConditionalFields();
  });
  
  // Initial evaluation
  evaluateConditionalFields();
}

function evaluateConditionalFields() {
  fieldConfigs.forEach(function(config) {
    if (!config.conditionalVisibility) return;
    
    const $field = $('#' + config.id);
    const $formGroup = $field.closest('.form-group');
    if (!$formGroup.length) return;
    
    try {
      // Build context with all form values
      const formValues = {};
      $('form').find('input, textarea, select').each(function() {
        const name = $(this).attr('name') || $(this).attr('id');
        formValues[name] = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
      });
      
      const conditionFn = new Function('values', 'return ' + config.conditionalVisibility);
      const shouldShow = conditionFn(formValues);
      
      if (shouldShow) {
        $formGroup.removeClass('field-hidden').show();
      } else {
        $formGroup.addClass('field-hidden').hide();
      }
    } catch (e) {
      console.error('Conditional visibility error:', e);
    }
  });
}

// =====================
// CUSTOM INIT
// =====================
function runCustomInitScripts() {
  fieldConfigs.forEach(function(config) {
    if (!config.customInit) return;
    
    const $field = $('#' + config.id);
    if (!$field.length) return;
    
    try {
      const initFn = new Function('field', config.customInit);
      initFn($field);
    } catch (e) {
      console.error('Custom init error:', e);
    }
  });
}

// =====================
// SAVE
// =====================
function save() {
  // Collect form data from all steps
  const formData = {};
  
  $('form').find('input, textarea, select').each(function() {
    const $field = $(this);
    const name = $field.attr('name') || $field.attr('id');
    
    // Skip hidden conditional fields
    if ($field.closest('.form-group').hasClass('field-hidden')) {
      return;
    }
    
    if (name) {
      if ($field.is(':checkbox')) {
        formData[name] = $field.is(':checked');
      } else if ($field.is(':radio')) {
        if ($field.is(':checked')) {
          formData[name] = $field.val();
        }
      } else {
        formData[name] = $field.val();
      }
    }
  });
  
  console.log('Saving form data:', formData);
  
  // Build inArguments
  const inArguments = Object.keys(formData).map(function(key) {
    const arg = {};
    arg[key] = formData[key];
    return arg;
  });
  
  payload['arguments'] = payload['arguments'] || {};
  payload['arguments'].execute = payload['arguments'].execute || {};
  payload['arguments'].execute.inArguments = inArguments;
  
  payload['metaData'] = payload['metaData'] || {};
  payload['metaData'].isConfigured = true;
  
  console.log('Final payload:', payload);
  
  connection.trigger('updateActivity', payload);
}

// Form validation
$('form').on('submit', function(e) {
  e.preventDefault();
  onClickedNext();
});

// Cancel button
$('#cancelBtn').on('click', function() {
  connection.trigger('requestInspectorClose');
});
