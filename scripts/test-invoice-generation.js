const fs = require('fs');
const path = require('path');

// Mock data for the 5 scenarios
const mockSettings = {
  brand_name: 'AK Enterprises',
  company_address: 'Garden View Complex, Erandwana, Pune, Maharashtra - 411004',
  company_gstin: '27AOOPL5548J1ZB',
  company_pan: 'AOOPL5548J',
  contact_email: 'akenterprises1411@gmail.com',
  contact_phone: '+91 83088 60894'
};

const baseOrder = {
  id: 'test-order-id',
  order_number: 'AKTEST1001',
  status: 'confirmed',
  total: 5670.00,
  placed_at: new Date().toISOString(),
  addresses: {
    full_name: 'Ayan Shaikh',
    phone: '918308860894',
    line1: 'Erandwana',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411004'
  },
  customer_profile: {
    company_name: 'Ayan Enterprises',
    gst_number: '27AAAAA1111A1Z1'
  },
  order_items: [
    {
      product_name_snapshot: 'Office File Binder Premium',
      hsn_code: '4820',
      quantity: 100,
      price_snapshot: 48.00,
      gst_percent: 18
    },
    {
      product_name_snapshot: 'Ballpoint Pen Blue Pack',
      hsn_code: '9608',
      quantity: 50,
      price_snapshot: 10.00,
      gst_percent: 18
    }
  ]
};

const scenarios = [
  {
    name: 'Scenario 1: Short Address (1 line)',
    order: {
      ...baseOrder,
      order_number: 'AKTEST1001',
      addresses: {
        ...baseOrder.addresses,
        line1: 'Flat 202, Erandwana',
        line2: ''
      }
    }
  },
  {
    name: 'Scenario 2: Bahut Lamba Address (ICICI Lombard Real Example)',
    order: {
      ...baseOrder,
      order_number: 'AKTEST1002',
      addresses: {
        ...baseOrder.addresses,
        line1: 'Office Nos. 105-108, 2GQ8+2FF Zodiac Square, First Floor, 60, Sarkhej-Gandhinagar Hwy, opp. Gurudwara, Bodakdev',
        line2: 'Ahmedabad, Gujarat'
      },
      customer_profile: {
        company_name: 'ICICI LOMBARD GIC LTD',
        gst_number: '24AAAAC1234A1Z5'
      }
    }
  },
  {
    name: 'Scenario 3: Single Item Order',
    order: {
      ...baseOrder,
      order_number: 'AKTEST1003',
      order_items: [
        {
          product_name_snapshot: 'Solo Display Folder A4',
          hsn_code: '3926',
          quantity: 20,
          price_snapshot: 120.00,
          gst_percent: 18
        }
      ]
    }
  },
  {
    name: 'Scenario 4: 10+ Items Order (Multi-page check)',
    order: {
      ...baseOrder,
      order_number: 'AKTEST1004',
      order_items: Array.from({ length: 12 }).map((_, idx) => ({
        product_name_snapshot: `B2B Supply Item Brand Model Category Pack #${idx + 1} - Extremely Long Product Description to Enforce Double Wrapping Checks inside the Multi-Page PDF Generation`,
        hsn_code: '4820',
        quantity: 10 + idx,
        price_snapshot: 50.00 + idx * 5,
        gst_percent: 18
      }))
    }
  },
  {
    name: 'Scenario 5: Missing Optional Fields (No Customer GST)',
    order: {
      ...baseOrder,
      order_number: 'AKTEST1005',
      customer_profile: {
        company_name: '',
        gst_number: '' // Missing customer GSTIN
      }
    }
  }
];

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING AUTOMATED PDF GENERATION TESTS');
  console.log('====================================================\n');

  // Dynamically import generators and validators (ESM support via dynamic import in Node)
  const { generateInvoicePDF } = await import('../lib/invoice-generator.js');
  const { generateChallanPDF } = await import('../lib/challan-generator.js');
  const { validateInvoiceData } = await import('../lib/invoice-validator.js');

  const outputDir = path.join(__dirname, '..', 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  let passed = 0;
  let failed = 0;

  for (const sc of scenarios) {
    console.log(`Testing: ${sc.name}`);
    
    // 1. Run Validation check
    const validationResult = validateInvoiceData(sc.order, mockSettings, false);
    if (!validationResult.valid) {
      console.error(`❌ Validation Failed: ${validationResult.error}`);
      failed++;
      continue;
    }
    console.log('  ✅ Validation Passed');

    try {
      // 2. Test Invoice Generation
      const invoiceBuffer = await generateInvoicePDF(sc.order, mockSettings);
      const invoicePath = path.join(outputDir, `invoice-${sc.order.order_number}.pdf`);
      fs.writeFileSync(invoicePath, Buffer.from(invoiceBuffer));
      console.log(`  ✅ Invoice Generated: ${invoicePath}`);

      // 3. Test Challan Generation
      const challanBuffer = await generateChallanPDF(sc.order, mockSettings);
      const challanPath = path.join(outputDir, `challan-${sc.order.order_number}.pdf`);
      fs.writeFileSync(challanPath, Buffer.from(challanBuffer));
      console.log(`  ✅ Challan Generated: ${challanPath}`);

      passed++;
    } catch (err) {
      console.error(`  ❌ Generation Failed with Exception:`, err.message);
      failed++;
    }
    console.log('');
  }

  console.log('====================================================');
  console.log(`📊 TESTS COMPLETED: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test run exception:', err);
  process.exit(1);
});
