import * as Icons from '../components/Icons'

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-semibold text-text mb-3 border-b border-neutral pb-2">{title}</h2>
    <div className="grid grid-cols-3 gap-4">{children}</div>
  </div>
)

const IconBox = ({ label, children, bg = 'bg-surface' }) => (
  <div className={`flex flex-col items-center gap-2 p-4 rounded-xl ${bg} border border-neutral/20`}>
    <div className="text-text">{children}</div>
    <span className="text-[10px] text-text-secondary font-medium text-center leading-tight">{label}</span>
  </div>
)

export default function IconPreview() {
  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Icon Library</h1>
      <p className="text-sm text-text-secondary mb-6">All redesigned icons — rounded & friendly style</p>

      <Section title="Tab Bar — Active (Filled)">
        <IconBox label="Home"><Icons.IconHomeFilled /></IconBox>
        <IconBox label="Lists"><Icons.IconListsFilled /></IconBox>
        <IconBox label="Stock"><Icons.IconStockFilled /></IconBox>
        <IconBox label="Profile"><Icons.IconProfileFilled /></IconBox>
      </Section>

      <Section title="Tab Bar — Inactive (Outlined)">
        <IconBox label="Home"><Icons.IconHome /></IconBox>
        <IconBox label="Lists"><Icons.IconLists /></IconBox>
        <IconBox label="Stock"><Icons.IconStock /></IconBox>
        <IconBox label="Profile"><Icons.IconProfile /></IconBox>
      </Section>

      <Section title="Action Icons">
        <IconBox label="Search"><Icons.IconSearch /></IconBox>
        <IconBox label="Cart"><Icons.IconCart /></IconBox>
        <IconBox label="Edit"><Icons.IconEdit /></IconBox>
        <IconBox label="Trash"><Icons.IconTrash /></IconBox>
        <IconBox label="Share"><Icons.IconShare /></IconBox>
        <IconBox label="Copy"><Icons.IconCopy /></IconBox>
        <IconBox label="Link"><Icons.IconLink /></IconBox>
        <IconBox label="Tag"><Icons.IconTag /></IconBox>
      </Section>

      <Section title="Navigation & Utility">
        <IconBox label="Back"><Icons.IconBack /></IconBox>
        <IconBox label="Chevron Down"><Icons.IconChevronDown /></IconBox>
        <IconBox label="Plus"><Icons.IconPlus /></IconBox>
        <IconBox label="Check"><Icons.IconCheck /></IconBox>
        <IconBox label="Close"><Icons.IconClose /></IconBox>
      </Section>

      <Section title="Empty State Illustrations">
        <IconBox label="No Lists" bg="bg-bg"><Icons.IllustrationNoLists /></IconBox>
        <IconBox label="No Items" bg="bg-bg"><Icons.IllustrationNoItems /></IconBox>
        <IconBox label="No Results" bg="bg-bg"><Icons.IllustrationNoResults /></IconBox>
      </Section>

      <Section title="Color Variants (examples)">
        <IconBox label="Primary">
          <div className="text-primary"><Icons.IconEdit className="w-7 h-7" /></div>
        </IconBox>
        <IconBox label="Danger">
          <div className="text-danger"><Icons.IconTrash className="w-7 h-7" /></div>
        </IconBox>
        <IconBox label="Green">
          <div className="text-green-dark"><Icons.IconCheck className="w-7 h-7" /></div>
        </IconBox>
      </Section>
    </div>
  )
}
