from pathlib import Path
import re, subprocess
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle, KeepTogether, Preformatted

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/lab-03/TokTickIT_Lab3_Final_Submission.pdf'
TMP = ROOT / 'artifacts/lab-03/.submission-crops'
TMP.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Title2', parent=styles['Title'], fontSize=22, leading=27, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name='Part', parent=styles['Heading1'], fontSize=17, leading=21, spaceBefore=5, spaceAfter=10, textColor=colors.HexColor('#14532d')))
styles.add(ParagraphStyle(name='H2x', parent=styles['Heading2'], fontSize=12, leading=15, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name='Bodyx', parent=styles['BodyText'], fontSize=8.5, leading=11.5, spaceAfter=5))
styles.add(ParagraphStyle(name='Small', parent=styles['BodyText'], fontSize=7.3, leading=9.5, textColor=colors.HexColor('#374151'), spaceAfter=4))
styles.add(ParagraphStyle(name='Caption', parent=styles['BodyText'], fontSize=7.5, leading=9.5, alignment=TA_CENTER, textColor=colors.HexColor('#374151'), spaceBefore=3, spaceAfter=6))
styles.add(ParagraphStyle(name='CodeSmall', parent=styles['Code'], fontSize=6.4, leading=8.0, leftIndent=5, rightIndent=5, spaceAfter=5))

def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def p(txt, style='Bodyx'):
    return Paragraph(esc(txt), styles[style])

def link(label, url):
    return Paragraph(f'<link href="{url}" color="#166534"><u>{esc(label)}</u></link>', styles['Bodyx'])

def md_plain(s):
    s = re.sub(r'`([^`]*)`', r'\1', s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', s)
    s = re.sub(r'^#{1,6}\s*', '', s)
    s = re.sub(r'^[-*]\s+', '- ', s)
    return s.strip()

def section(md_path, start, end=None, max_lines=80):
    lines = (ROOT/md_path).read_text(encoding='utf-8').splitlines()
    begin = next((i for i,x in enumerate(lines) if start.lower() in x.lower()), 0)
    stop = len(lines)
    if end:
        stop = next((i for i,x in enumerate(lines[begin+1:], begin+1) if end.lower() in x.lower()), len(lines))
    out=[]
    for x in lines[begin:stop]:
        x=md_plain(x)
        if x: out.append(x)
        if len(out)>=max_lines: break
    return out

def render_lines(story, title, lines, note=None):
    story.append(p(title,'H2x'))
    if note: story.append(p(note,'Small'))
    for x in lines:
        if x.startswith('|'):
            story.append(Preformatted(x, styles['CodeSmall']))
        else:
            story.append(p(x))

def run(cmd):
    return subprocess.check_output(cmd, cwd=ROOT, shell=True, text=True, encoding='utf-8', errors='replace').strip()

def add_image_page(story, path, title, caption, crop=None):
    src = Path(path)
    img_path = src
    if crop:
        im=PILImage.open(src)
        w,h=im.size
        top,bottom=crop
        top=max(0,min(h-1,top)); bottom=max(top+1,min(h,bottom))
        out=TMP/(src.parent.name+'-'+src.stem+f'-{top}-{bottom}.png')
        im.crop((0,top,w,bottom)).save(out, optimize=True)
        img_path=out
    im=PILImage.open(img_path)
    iw,ih=im.size
    maxw,maxh=178*mm,220*mm
    scale=min(maxw/iw,maxh/ih)
    ri=Image(str(img_path), width=iw*scale, height=ih*scale)
    story.append(PageBreak())
    story.append(p(title,'H2x'))
    story.append(ri)
    story.append(p(caption,'Caption'))

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont('Helvetica',7); canvas.setFillColor(colors.HexColor('#4b5563'))
    canvas.drawString(16*mm,9*mm,'TokTickIT Lab 3 - Final Submission Evidence')
    canvas.drawRightString(194*mm,9*mm,f'Page {doc.page}')
    canvas.restoreState()

story=[]
story += [Spacer(1,18*mm), p('TokTickIT Lab 3 Final Submission','Title2'), p('Rubric-aligned evidence package','Title2'), Spacer(1,5*mm)]
story.append(p('Author: Chartanat Upthaipiboon | Student ID: 67070507210','Bodyx'))
story.append(p('Repository: Chxtamos/-TokTickIT- | Verified released main before this evidence-only update: 319c34c3d23a86fa6a28ef74d7f9d8e11f1a6de6','Bodyx'))
story.append(link('Repository', 'https://github.com/Chxtamos/-TokTickIT-'))
story.append(link('GitHub Project / Kanban', 'https://github.com/users/Chxtamos/projects/6'))
story.append(p('This PDF follows the Lab 3 handout order exactly: Answer Part 1 through Answer Part 9. UI screenshots are intentionally enlarged; long full-page captures are cropped to readable evidence regions rather than reduced into unreadable contact sheets.','Small'))
story.append(PageBreak())

# Part 1
story.append(p('Answer Part 1: Git Use with Engineering Workflow','Part'))
story.append(p('Workflow evidence: feature/documentation branches were reviewed into lab3-staging, then release PRs promoted staging to main. PR #89 is the final documentation release currently on main.'))
for n in [68,69,70,71,72,74,76,77,78,79,80,81,82,84,86,87,88,89]:
    story.append(link(f'PR #{n}', f'https://github.com/Chxtamos/-TokTickIT-/pull/{n}'))
story.append(p('Final Project/Kanban status: Issue #65 and release PR #89 were verified Done after merge. Earlier implementation Issues were completed through their merged feature PRs.','Bodyx'))
try:
    log=run('git log --oneline --decorate --merges -18')
    story.append(p('Recent merge history','H2x')); story.append(Preformatted(log,styles['CodeSmall']))
except Exception: pass
render_lines(story,'Rendered reviewer.md - identity and review evidence',section('docs/lab-03/reviewer.md','## Author and reviewer','## Contract review checklist',35),'Full source: docs/lab-03/reviewer.md')
render_lines(story,'Rendered reviewer.md - implementation/release log excerpt',section('docs/lab-03/reviewer.md','## Implementation and release log','## PR #68 requested changes',45),'Includes reviewer identity, reviewed heads, requested-change responses, approvals, CI and merge evidence.')
story.append(PageBreak())
story.append(p('README, .gitignore, and repository structure evidence','H2x'))
render_lines(story,'docs/lab-03/README.md excerpt',section('docs/lab-03/README.md','#',None,35))
try:
    gi=(ROOT/'.gitignore').read_text(encoding='utf-8').splitlines()[:60]
    story.append(p('.gitignore excerpt','H2x')); story.append(Preformatted('\n'.join(gi),styles['CodeSmall']))
except Exception: pass
try:
    tree=run('git ls-files | findstr /R "^docs/lab-03/ ^server/tests/lab-03/ ^client/e2e/lab-03/ ^artifacts/lab-03/"')
    story.append(p('Lab 3 repository structure (tracked files excerpt)','H2x')); story.append(Preformatted('\n'.join(tree.splitlines()[:90]),styles['CodeSmall']))
except Exception: pass

# Part 2
story.append(PageBreak()); story.append(p('Answer Part 2: Spec DD','Part'))
story.append(link('Full specification.md','https://github.com/Chxtamos/-TokTickIT-/blob/main/docs/lab-03/specification.md'))
render_lines(story,'Rendered specification - Sprint Goal and Scope',section('docs/lab-03/specification.md','## 1. Sprint Goal','## 4. Functional Requirements',45))
render_lines(story,'Rendered specification - numbered Functional Requirements',section('docs/lab-03/specification.md','## 4. Functional Requirements','## 5. Business Rules',40))
story.append(PageBreak())
render_lines(story,'Rendered specification - Business Rules and Authorization',section('docs/lab-03/specification.md','## 5. Business Rules','### Ticket, ownership',70))
render_lines(story,'Rendered specification - Acceptance Criteria',section('docs/lab-03/specification.md','## 10. Acceptance Criteria','## 11.',70))
render_lines(story,'Rendered specification - Migration decisions and Product Definition of Done',section('docs/lab-03/specification.md','## 11.','',65),'The full linked specification remains the source of truth; this PDF renders the grading-relevant contract excerpts.')
story.append(p('Specification timing evidence: PR #68 was the contract review before the main implementation PR sequence (#69 onward).','Bodyx'))
story.append(link('PR #68 - Engineering Contract review','https://github.com/Chxtamos/-TokTickIT-/pull/68'))

# Part 3
story.append(PageBreak()); story.append(p('Answer Part 3: Test DD and Traceability','Part'))
story.append(link('Full tests.md','https://github.com/Chxtamos/-TokTickIT-/blob/main/docs/lab-03/tests.md'))
render_lines(story,'Rendered tests.md - strategy / planned coverage',section('docs/lab-03/tests.md','# Lab 3','## Acceptance',55))
render_lines(story,'Rendered tests.md - AC traceability excerpt',section('docs/lab-03/tests.md','AC-01','##',60),'Traceability rows preserve AC IDs, test type/path and status in the source document.')
story.append(PageBreak())
render_lines(story,'Rendered tests.md - final release synchronization',section('docs/lab-03/tests.md','### Final release synchronization',None,35))
story.append(p('Exact released-main CI after PR #89 merge (main 319c34c): Client run 37136334077 SUCCESS; Server run 37136334040 SUCCESS; E2E run 37136334094 SUCCESS.','Bodyx'))
for label,rid in [('Client CI',37136334077),('Server CI',37136334040),('E2E CI',37136334094)]: story.append(link(f'{label} run {rid}',f'https://github.com/Chxtamos/-TokTickIT-/actions/runs/{rid}'))
for fn in ['final-main-client-ci.log','final-main-server-ci.log','final-main-e2e-ci.log']:
    fp=ROOT/'artifacts/lab-03/test-results'/fn
    if fp.exists():
        lines=fp.read_text(encoding='utf-8',errors='replace').splitlines()
        story.append(p(f'Rendered passing output: {fn}','H2x')); story.append(Preformatted('\n'.join(lines[-32:]),styles['CodeSmall']))

# Part 4
story.append(PageBreak()); story.append(p('Answer Part 4: AI Use with Reflection','Part'))
story.append(link('Full ai-use.md','https://github.com/Chxtamos/-TokTickIT-/blob/main/docs/lab-03/ai-use.md'))
render_lines(story,'Rendered ai-use.md - LLM and selected prompts',section('docs/lab-03/ai-use.md','#','## My Reflection',100),'The source records the actual AI workflow and selected prompts; wording is preserved from the repository.')
render_lines(story,'My Reflection (student-authored source)',section('docs/lab-03/ai-use.md','## My Reflection',None,60),'This section is rendered from the existing repository file; it is not newly fabricated for this PDF.')

# Part 5
story.append(PageBreak()); story.append(p('Answer Part 5: Working Login and Password Change UI','Part'))
story.append(p('Evidence coverage: valid/invalid credentials, inactive-account handling, safe failures/rate limits, mandatory first-password change, authenticated user/role display, logout and blocked direct access are covered by authentication E2E/API/UI tests. The large UI capture below demonstrates the Zen Green login surface; detailed state behavior is traceable in tests.md and authentication.spec.ts.'))
story.append(link('authentication.spec.ts','https://github.com/Chxtamos/-TokTickIT-/blob/main/client/e2e/lab-03/authentication.spec.ts'))
add_image_page(story,ROOT/'artifacts/lab-03/screenshots/1440/01-login.png','Part 5 UI Evidence - Login (desktop)','1440px desktop login. Enlarged as a single image so fields, labels, button and validation area remain readable.')

# Part 6
story.append(PageBreak()); story.append(p('Answer Part 6: Working IT Staff Ticket Queue UI','Part'))
story.append(p('Queue evidence covers realistic seeded Tickets, search, filters, sorting, pagination, assigned/unassigned ownership, status/priority badges, detail navigation, empty/no-results/failure feedback and responsive behavior.'))
story.append(link('staff-queue.spec.ts','https://github.com/Chxtamos/-TokTickIT-/blob/main/client/e2e/lab-03/staff-queue.spec.ts'))
add_image_page(story,ROOT/'artifacts/lab-03/screenshots/1440/03-staff-queue.png','Part 6 UI Evidence - Staff Queue (desktop)','Top operational queue region at 1440px.',(0,1350))

# Part 7
story.append(PageBreak()); story.append(p('Answer Part 7: Working IT Staff Ticket Detail UI','Part'))
story.append(p('Staff Detail evidence covers claim/reassign, IT Priority, permitted status transitions, Public Comments, restricted Internal Notes, Attachment continuity, Requester resolution indication, role restrictions, validation/conflict handling and safe failures. Direct authorization suites verify Requesters cannot retrieve Internal Notes or infer protected-resource existence.'))
story.append(link('staff-ticket-flow.spec.ts','https://github.com/Chxtamos/-TokTickIT-/blob/main/client/e2e/lab-03/staff-ticket-flow.spec.ts'))
story.append(link('authorization.api.test.ts','https://github.com/Chxtamos/-TokTickIT-/blob/main/server/tests/lab-03/authorization.api.test.ts'))
add_image_page(story,ROOT/'artifacts/lab-03/screenshots/1440/04-staff-ticket-detail.png','Part 7 UI Evidence - Staff Ticket Detail (top)','Ticket identity, requester context and operational controls.',(0,1450))
add_image_page(story,ROOT/'artifacts/lab-03/screenshots/1440/04-staff-ticket-detail.png','Part 7 UI Evidence - Staff Ticket Detail (lower)','Lower detail region including conversation/notes evidence.',(1450,2982))

# Part 8
story.append(PageBreak()); story.append(p('Answer Part 8: Working Administrator User Management UI','Part'))
story.append(p('Admin evidence covers Name/Email/Role/Status/Edit list, search, optional role filter, create with one role and initial password, duplicate/invalid validation, edit name/email/role/activation, reset initial password, self-deactivation protection, last-active-Administrator protection, forbidden non-Admin access, responsive Zen Green layout and safe failure feedback.'))
story.append(link('admin-user-management.spec.ts','https://github.com/Chxtamos/-TokTickIT-/blob/main/client/e2e/lab-03/admin-user-management.spec.ts'))
add_image_page(story,ROOT/'artifacts/lab-03/screenshots/1440/05-admin-user-management.png','Part 8 UI Evidence - Administrator User Management','1440px Administrator User Management. The image is displayed large enough to read columns, role/status badges and actions.')

# Part 9
story.append(PageBreak()); story.append(p('Answer Part 9: Zen Green UI and Responsive Evidence','Part'))
story.append(link('Full ui-spec.md','https://github.com/Chxtamos/-TokTickIT-/blob/main/docs/lab-03/ui-spec.md'))
render_lines(story,'Rendered ui-spec.md - Zen Green contract',section('docs/lab-03/ui-spec.md','#','## 4.',65),'Rendered grading-relevant visual/accessibility rules from the repository source.')
story.append(p('Completed evidence checklist','H2x'))
check=[
('Design consistency','PASS','Zen Green tokens/shell used across Login, Requester, Staff and Admin captures.'),
('Role navigation','PASS','Role-specific screens/navigation are covered by UI/E2E authorization evidence.'),
('Badges','PASS','Status, Requested Priority, IT Priority and role presentation are visible/covered.'),
('Editable vs read-only fields','PASS','UI contract and Staff/Admin captures preserve distinct operational/editable controls.'),
('Validation placement','PASS','UI tests cover validation/safe failure placement; no layout regression reported in final evidence run.'),
('Focus / keyboard behavior','PASS - automated evidence','Dialog/keyboard and accessibility-focused tests are recorded in tests.md; this label does not invent a separate human sign-off.'),
('Clipping / overlap','PASS','Final responsive capture suite found and fixed real 768 Requester and 360 Admin overflow defects before rerun.'),
('Horizontal overflow','PASS','Final responsive suite asserts no document-level horizontal overflow at required evidence widths.'),
('Secret/Internal Note leakage','PASS','Peer review of PR #86 opened screenshots and confirmed no secret leakage; API authorization tests protect Internal Notes.'),
]
t=Table([[p('Checklist','Small'),p('Status','Small'),p('Evidence','Small')]]+[[p(a,'Small'),p(b,'Small'),p(c,'Small')] for a,b,c in check],colWidths=[38*mm,35*mm,105*mm],repeatRows=1)
t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.3,colors.HexColor('#d1d5db')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#dcfce7')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)])); story.append(t)
story.append(p('Note: this checklist reports evidence supported by tests, screenshots and peer-review records. It does not falsely claim that an AI is a human accessibility reviewer.','Small'))

# Major screen screenshots: desktop/tablet/mobile, readable viewport crops.
screens=[('01-login.png','Login'),('02-requester-my-tickets.png','Requester My Tickets'),('03-staff-queue.png','Staff Queue'),('04-staff-ticket-detail.png','Staff Ticket Detail'),('05-admin-user-management.png','Administrator User Management')]
viewports=[('1440',900,'Desktop 1440px'),('768',1024,'Tablet 768px'),('390',844,'Mobile 390px')]
for folder,h,label in viewports:
    for fn,name in screens:
        src=ROOT/'artifacts/lab-03/screenshots'/folder/fn
        if not src.exists(): continue
        ih=PILImage.open(src).size[1]
        add_image_page(story,src,f'Part 9 - {label}: {name}',f'{label} evidence for {name}. Shown as a readable viewport crop; full original capture remains in artifacts/lab-03/screenshots/{folder}/.',(0,min(h,ih)))

# Extra narrow mobile and zoom evidence for the two most grading-sensitive screens.
for folder,h,label in [('360',800,'Narrow mobile 360px'),('zoom-200',900,'200% zoom-equivalent')]:
    for fn,name in [('03-staff-queue.png','Staff Queue'),('05-admin-user-management.png','Administrator User Management')]:
        src=ROOT/'artifacts/lab-03/screenshots'/folder/fn
        if src.exists(): add_image_page(story,src,f'Part 9 - {label}: {name}',f'Additional {label} evidence. Original full-page capture is preserved in the repository.',(0,min(h,PILImage.open(src).size[1])))

story.append(PageBreak()); story.append(p('Final Verification','Part'))
story.append(p('Released main verified before this evidence-only PDF update: 319c34c3d23a86fa6a28ef74d7f9d8e11f1a6de6. Post-merge CI: Client 37136334077 SUCCESS, Server 37136334040 SUCCESS, E2E 37136334094 SUCCESS. Issue #65 and PR #89 were verified Done in the GitHub Project.'))
story.append(p('The repository and final main branch remain the source of truth. This PDF intentionally renders the grading-relevant portions of specification.md, tests.md, ai-use.md, reviewer.md and ui-spec.md and links to the complete files.'))

doc=SimpleDocTemplate(str(OUT),pagesize=A4,leftMargin=16*mm,rightMargin=16*mm,topMargin=15*mm,bottomMargin=15*mm,title='TokTickIT Lab 3 Final Submission')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
for f in TMP.glob('*'): f.unlink()
TMP.rmdir()
print(OUT)
