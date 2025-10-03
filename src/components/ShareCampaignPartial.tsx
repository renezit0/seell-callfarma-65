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
          top: '0',
          width: '1600px',
          padding: '40px',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          boxSizing: 'border-box'
        }}
      >
        {headerImage && (
          <div style={{ 
            marginBottom: '40px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <img 
              src={headerImage} 
              alt="Header"
              style={{ 
                width: '100%', 
                height: 'auto',
                display: 'block',
                maxWidth: '100%'
              }} 
            />
          </div>
        )}

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '30px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {grupos.map((grupo) => {
            const lojasOrdenadas = [...grupo.lojas].sort((a, b) => b.percentual - a.percentual);
            
            return (
              <div 
                key={grupo.numeroGrupo}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box'
                }}
              >
                {/* Header do Grupo */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  <span style={{
                    fontSize: '22px',
                    fontWeight: '700'
                  }}>
                    🏆
                  </span>
                  <span style={{
                    fontSize: '22px',
                    fontWeight: '700',
                    color: '#000000'
                  }}>
                    Grupo {grupo.numeroGrupo}
                  </span>
                  <div style={{
                    backgroundColor: '#fbbf24',
                    color: '#000',
                    padding: '8px 16px',
                    borderRadius: '16px',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}>
                    {lojasOrdenadas.length}
                  </div>
                </div>

                {/* Lista de Lojas */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px'
                }}>
                  {lojasOrdenadas.map((loja, index) => {
                    let bg = '#ffffff';
                    let border = '#d1d5db';
                    
                    if (index === 0) { 
                      bg = '#fef3c7'; 
                      border = '#fbbf24'; 
                    } else if (index === 1) { 
                      bg = '#e5e7eb'; 
                      border = '#9ca3af'; 
                    } else if (index === 2) { 
                      bg = '#fed7aa'; 
                      border = '#fb923c'; 
                    }

                    return (
                      <div
                        key={loja.numero}
                        style={{
                          backgroundColor: bg,
                          border: `2px solid ${border}`,
                          borderRadius: '12px',
                          padding: '18px 20px',
                          boxSizing: 'border-box',
                          display: 'table',
                          width: '100%',
                          tableLayout: 'fixed'
                        }}
                      >
                        <div style={{
                          display: 'table-row'
                        }}>
                          {/* Medalha */}
                          <div style={{
                            display: 'table-cell',
                            width: '50px',
                            verticalAlign: 'middle',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              backgroundColor: index > 2 ? '#e5e7eb' : 'transparent',
                              borderRadius: '50%',
                              fontSize: '18px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`}
                            </div>
                          </div>

                          {/* Nome da Loja */}
                          <div style={{
                            display: 'table-cell',
                            verticalAlign: 'middle',
                            paddingLeft: '12px',
                            paddingRight: '12px'
                          }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#000000',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {loja.numero} - {loja.nome}
                            </div>
                          </div>

                          {/* Percentual */}
                          <div style={{
                            display: 'table-cell',
                            width: '140px',
                            verticalAlign: 'middle',
                            textAlign: 'right'
                          }}>
                            <div style={{
                              fontSize: '22px',
                              fontWeight: '700',
                              color: '#000000',
                              lineHeight: '1.2',
                              marginBottom: '4px'
                            }}>
                              {loja.percentual.toFixed(1)}%
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#6b7280',
                              lineHeight: '1.2',
                              whiteSpace: 'nowrap'
                            }}>
                              ({formatarValor(loja.realizado)}/{formatarValor(loja.meta)})
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

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid #d1d5db',
          textAlign: 'center',
          fontSize: '12px',
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
          Faça upload do cabeçalho da campanha para gerar a imagem
        </p>
      )}
    </div>
  );
}