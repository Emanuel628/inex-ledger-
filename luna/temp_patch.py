from pathlib import Path
path = Path('src/pages/Settings.jsx')
text = path.read_text()
start = text.index('          <div className="settings-container">')
end = text.index('      {hiddenOverlayOpen', start)
new_block = """          <div className=\"settings-container\">\n            {activeTab === \"Account\" && renderAccountSection()}\n            {activeTab === \"Security\" && renderSecuritySection()}\n            {activeTab === \"Financial\" && renderFinancialSection()}\n            {activeTab === \"Experience\" && renderExperienceSection()}\n            {activeTab === \"Notifications\" && renderNotificationsSection()}\n            {activeTab === \"Advanced\" && renderAdvancedSection()}\n            <div className=\"settings-footer-note helper-note\">\n              Luna is modeling insights from your inputsƒ?\"this page reflects system-generated snapshots, not personalized financial advice. Your billing identity (email/Stripe) stays in a separate silo from the encrypted vault and is linked only by the blind UUID. Every export, ledger sync, and purge is logged so your compliance trail stays verifiable.\n            </div>\n          </div>\n"""
text = text[:start] + new_block + text[end:]
path.write_text(text)
