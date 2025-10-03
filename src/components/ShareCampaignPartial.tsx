import { Button } from "@/components/ui/button";
import { Share2, Download, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

interface ShareCampaignPartialProps {
  campanha: {
    nome: string;
    data_inicio: string;
    data_fim: string;
    tipo_meta: 'quantidade' | 'valor';
  };
  grupos: Array<{
    numeroGrupo: number;
    lojas: Array<{
      numero: string;
      nome: string;
      realizado: number;
      meta: number;
      percentual: number;
    }>;
  }>;
}

export function ShareCampaignPartial({ campanha, grupos }: ShareCampaignPartialProps) {
  const shareRef = useRef<HTMLDivElement | null>(null);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setHeaderImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = async () => {
    const targetRef = shareRef.current;
    if (!targetRef) return;

    try {
      const canvas = await html2canvas(targetRef, {
        backgroundColor: '#ffffff',
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      return null;
    }
  };

  const handleShare = async () => {
    try {
      const imageData = await generateImage();
      if (!imageData) return;

      const response = await fetch(imageData);
      const blob = await response.blob();
      
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `parcial-campanha.png`, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Parcial - ${campanha.nome}`,
            files: [file]
          });
          toast.success('Compartilhado!');
        } else {
          downloadImage(imageData);
        }
      } else {
        downloadImage(imageData);
      }
    } catch (error) {
      toast.error('Erro ao compartilhar');
    }
  };

  const downloadImage = (imageData: string) => {
    const link = document.createElement('a');
    link.download = `parcial-${Date.now()}.png`;
    link.href = imageData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Baixado!');
  };

  const formatarValor = (valor: number) => {
    if (campanha.tipo_meta === 'valor') {
      return formatCurrency(valor);
    }
    return `${valor} un`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Cabeçalho da Campanha</Label>
            <div className="flex gap-2 mt-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="flex-1"
              />
              {headerImage && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setHeaderImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {headerImage && (
            <div className="border rounded-lg overflow-hidden">
              <img src={headerImage} alt="Preview" className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      <div 
        ref={shareRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '1600px',
          padding: '30px',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        {headerImage && (
          <div style={{ marginBottom: '30px' }}>
            <img src={headerImage} style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {grupos.map((grupo) => {
            const lojasOrdenadas = [...grupo.lojas].sort((a, b) => b.percentual - a.percentual);
            
            return (
              <div key={grupo.numeroGrupo}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '15px'
                }}>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    lineHeight: '1'
                  }}>
                    <span style={{ display: 'inline-block', transform: 'translateY(0)' }}>🏆</span>
                    <span style={{ display: 'inline-block', transform: 'translateY(0)' }}>Grupo {grupo.numeroGrupo}</span>
                  </span>
                  <span style={{
                    backgroundColor: '#fbbf24',
                    color: '#000',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    lineHeight: '1',
                    display: 'inline-block'
                  }}>
                    {lojasOrdenadas.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lojasOrdenadas.map((loja, index) => {
                    let bg = '#ffffff';
                    let border = '#d1d5db';
                    
                    if (index === 0) { bg = '#fef3c7'; border = '#fbbf24'; }
                    else if (index === 1) { bg = '#e5e7eb'; border = '#9ca3af'; }
                    else if (index === 2) { bg = '#fed7aa'; border = '#fb923c'; }

                    return (
                      <div
                        key={loja.numero}
                        style={{
                          display: 'table',
                          width: '100%',
                          backgroundColor: bg,
                          border: `2px solid ${border}`,
                          borderRadius: '10px',
                          height: '60px',
                          marginBottom: index < lojasOrdenadas.length - 1 ? '6px' : '0',
                          tableLayout: 'fixed'
                        }}
                      >
                        <div style={{ display: 'table-row', height: '60px' }}>
                          <div style={{
                            display: 'table-cell',
                            width: '60px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              width: '34px',
                              height: '34px',
                              lineHeight: '34px',
                              backgroundColor: index > 2 ? '#e5e7eb' : 'transparent',
                              borderRadius: '50%',
                              fontSize: '14px',
                              fontWeight: '700',
                              textAlign: 'center'
                            }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`}
                            </span>
                          </div>

                          <div style={{
                            display: 'table-cell',
                            verticalAlign: 'middle',
                            paddingLeft: '4px',
                            paddingRight: '8px'
                          }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#000000',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {loja.numero} - {loja.nome}
                            </div>
                          </div>

                          <div style={{
                            display: 'table-cell',
                            width: '120px',
                            verticalAlign: 'middle',
                            paddingRight: '14px'
                          }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                fontSize: '18px',
                                fontWeight: '700',
                                color: '#000000',
                                lineHeight: '1.3'
                              }}>
                                {loja.percentual.toFixed(1)}%
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: '#6b7280',
                                lineHeight: '1.3'
                              }}>
                                ({formatarValor(loja.realizado)}/{formatarValor(loja.meta)})
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: '30px',
          paddingTop: '15px',
          borderTop: '1px solid #d1d5db',
          textAlign: 'center',
          fontSize: '11px',
          color: '#9ca3af'
        }}>
          Gerado em {new Date().toLocaleString('pt-BR')}
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleShare}
          className="flex-1"
          disabled={!headerImage}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
        <Button 
          onClick={async () => {
            const imageData = await generateImage();
            if (imageData) downloadImage(imageData);
          }}
          variant="outline"
          disabled={!headerImage}
        >
          <Download className="w-4 h-4 mr-2" />
          Baixar
        </Button>
      </div>

      {!headerImage && (
        <p className="text-sm text-muted-foreground text-center">
          Faça upload do cabeçalho
        </p>
      )}
    </div>
  );
}