/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search) => {
        const beforeSubmit = (scriptContext) => {
            // Initialize variables
            const type = scriptContext.type;
            const stripeBusinessUnitId = "7";
            let countryCodeIso = '';
            let invoiceRecord = scriptContext.newRecord;
            let businessUnitId = '';
            let taxCodeInternalId = '';
            let billingAddressSubRecord = '';
            let runTaxCodeMapping = false;
            businessUnitId = invoiceRecord.getValue({fieldId: 'class'});
            billingAddressSubRecord = invoiceRecord.getSubrecord({
                fieldId: 'billingaddress'
            });
            log.debug('Billing Address Record', billingAddressSubRecord);
            countryCodeIso = billingAddressSubRecord.getValue({ fieldId: "country" });
            runTaxCodeMapping = getStripeSetupRecord(stripeBusinessUnitId);
            
            log.debug("Run tax mapping variables",{type: type, businessUnitId: businessUnitId, stripeBusinessUnitId: stripeBusinessUnitId, runTaxCodeMapping: runTaxCodeMapping});
            if (type === scriptContext.UserEventType.EDIT && businessUnitId === stripeBusinessUnitId && runTaxCodeMapping == true) {
                taxCodeInternalId = lookupTaxCode(businessUnitId, countryCodeIso);
                log.debug('Tax Code Internal Id in if condition', taxCodeInternalId);
                if (taxCodeInternalId !== undefined || taxCodeInternalId !== ''){
                    log.debug('Tax Code Found', taxCodeInternalId);
                    const invoiceItemLineCount = invoiceRecord.getLineCount({ sublistId: 'item' });
                    for (let i =0; i< invoiceItemLineCount; i++) {
                        invoiceRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            line: i,
                            value: taxCodeInternalId
                        });
                    }
                }
            }
        }
        function lookupTaxCode(businessUnitId, countryCodeIso) {
            log.debug('Lookup Tax Code triggered', {businessUnitId: businessUnitId, countryCodeIso: countryCodeIso});
            taxCodeInternalId = null;
            if (businessUnitId !== '' || businessUnitId !== undefined || countryCodeIso !== '' || countryCodeIso !== undefined) {
                const taxCodeSearch = search.create({
                    type: 'customrecord_mhi_stripe_tax_table',
                    filters: [
                        ['custrecord_mhi_tax_map_business_unit', 'anyof', businessUnitId],
                        "AND",
                        ["custrecord_mhi_tax_map_country", "is", countryCodeIso]
                    ],
                    columns: [
                        'custrecord_mhi_tax_map_tax_code'
                    ]
                }).run().each(function(result) {
                    taxCodeInternalId = result.getValue({ name: 'custrecord_mhi_tax_map_tax_code' });
                    if (taxCodeInternalId !== null && taxCodeInternalId !== '') {
                        return;
                    }
                    else{
                        log.error('Tax Code Not Found', 'No tax code found for the given business unit and country code.');
                        taxCodeInternalId = null;
                        return false; // Stop the search if no tax code is found
                    }
                });
            }
            else {
                log.error('Business Unit ID or Country Code is not defined', 'Please check the business unit ID and billing country provided.');
            }
            return taxCodeInternalId;
        }
        function getStripeSetupRecord(businessUnitId){
            let taxCodeMappingConfig = null; // If this checkbox is not checked, the code will not run
            const stripeSetupRecord = search.create({
                type: 'customrecord_mhi_stripe_setup',
                filters: [
                    ['custrecord_mhi_setup_subsidiary', 'anyof', businessUnitId]
                ],
                columns: [
                    'custrecord_mhi_tax_mapping'
                ]
            }).run().each(function(result) {
                log.debug('Stripe Setup Record', result);
                taxCodeMappingConfig = result.getValue({ name: 'custrecord_mhi_tax_mapping' });
                log.debug('Tax Code Mapping Config', taxCodeMappingConfig);
            });
            return taxCodeMappingConfig;
        }
        return {beforeSubmit}
        
    });
